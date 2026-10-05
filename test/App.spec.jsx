import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from '../src/App.jsx';
import { ErrorBoundary } from '../src/components/ErrorBoundary.jsx';
import { installMockWebSocket } from './helpers/mockWebSocket.js';

vi.mock('../src/eventValidation.js', () => ({ acceptEvent: () => true }));

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App relay failures', () => {
  it('shows an error with Retry instead of "No events found", and recovers', async () => {
    let healthy = false;
    installMockWebSocket((url, filter, ws) => {
      if (!healthy) {
        ws.close();
        return;
      }
      if (filter.authors && !filter.kinds) {
        ws.emit([
          'EVENT',
          ws.subId,
          {
            id: 'n1',
            pubkey: '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a',
            kind: 1,
            created_at: 5,
            tags: [],
            content: 'hello relay',
          },
        ]);
      }
      ws.emit(['EOSE', ws.subId]);
    });

    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the Nostr relays.');
    expect(screen.queryByText('No events found in this category.')).toBeNull();

    healthy = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('hello relay')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('App URL handling', () => {
  const OWNER = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';

  it('fetches the category from the URL on first load', async () => {
    window.history.replaceState({}, '', '/?kind=books');
    const filters = [];
    installMockWebSocket((url, filter, ws) => {
      filters.push(filter);
      ws.emit(['EOSE', ws.subId]);
    });
    render(<App />);
    await waitFor(() => expect(filters.some((f) => f.kinds && f.kinds.includes(30040))).toBe(true));
  });

  it('loads a directly opened post that is not in the feed, and goes back to the right feed URL', async () => {
    const id = 'cd'.repeat(32);
    window.history.replaceState({}, '', `/p/${id}`);
    installMockWebSocket((url, filter, ws) => {
      if (filter.ids && filter.ids.includes(id)) {
        ws.emit(['EVENT', ws.subId, { id, pubkey: OWNER, kind: 1, created_at: 1, tags: [], content: 'old post' }]);
      }
      ws.emit(['EOSE', ws.subId]);
    });
    render(<App />);
    expect(await screen.findByText('old post')).toBeInTheDocument();
    expect(screen.getByText('← Back to all posts').getAttribute('href')).toBe('/');
  });

  it('shows an invalid-link message for undecodable post ids', async () => {
    window.history.replaceState({}, '', '/p/note1garbage');
    installMockWebSocket((url, filter, ws) => ws.emit(['EOSE', ws.subId]));
    render(<App />);
    expect(await screen.findByText('Invalid post link.')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('renders a fallback when a child throws', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('This event could not be displayed.')).toBeInTheDocument();
  });
});
