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
