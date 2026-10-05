import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNostrFeed } from '../src/hooks/useNostrFeed.js';
import { installMockWebSocket } from './helpers/mockWebSocket.js';

// Signature checks are covered in relayClient.spec.js
vi.mock('../src/eventValidation.js', () => ({ acceptEvent: () => true }));

afterEach(() => {
  vi.unstubAllGlobals();
});

const OWNER = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const ev = (id, created_at, extra = {}) => ({
  id,
  pubkey: OWNER,
  kind: 1,
  created_at,
  tags: [],
  content: '',
  ...extra,
});

/** Fake relay that answers REQs from an in-memory event list. */
function fakeRelay(store, requests) {
  return (url, filter, ws) => {
    requests.push(filter);
    let matches = store.filter((e) => {
      if (filter.ids && !filter.ids.includes(e.id)) return false;
      if (filter.authors && !filter.authors.includes(e.pubkey)) return false;
      if (filter.kinds && !filter.kinds.includes(e.kind)) return false;
      if (filter.until !== undefined && e.created_at > filter.until) return false;
      return true;
    });
    matches = matches.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit ?? 1000);
    matches.forEach((e) => ws.emit(['EVENT', ws.subId, e]));
    ws.emit(['EOSE', ws.subId]);
  };
}

const relays = ['wss://r'];

describe('useNostrFeed', () => {
  it("lists only the owner's events and keeps foreign parents for lookups", async () => {
    const parent = ev('parent', 5, { pubkey: OTHER });
    const reply = ev('reply', 10, { tags: [['e', 'parent']] });
    installMockWebSocket(fakeRelay([parent, reply], []));

    const { result } = renderHook(() => useNostrFeed(OWNER, relays));

    await waitFor(() => expect(result.current.eventMap.has('parent')).toBe(true));
    expect(result.current.events.map((e) => e.id)).toEqual(['reply']);
    expect(result.current.categoryCounts.all).toBe(1);

    // A later update (e.g. a category fetch) must not leak the parent into the feed either.
    await act(() => result.current.fetchCategoryEvents('notes'));
    expect(result.current.events.map((e) => e.id)).toEqual(['reply']);
  });

  it('does not let a category fetch move the unfiltered paging cursor', async () => {
    // 100 recent notes fill the initial page; the old book only shows up via the category query.
    const store = [
      ...Array.from({ length: 100 }, (_, i) => ev(`n${i}`, 2000 - i)),
      ev('book-old', 100, { kind: 30040, tags: [['d', 'x']] }),
    ];
    const requests = [];
    installMockWebSocket(fakeRelay(store, requests));

    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.fetchCategoryEvents('books'));
    expect(result.current.events.map((e) => e.id)).toContain('book-old');

    requests.length = 0;
    await act(() => result.current.loadOlderEvents('notes'));
    const page = requests.find((f) => f.until !== undefined);
    // Cursor is the oldest *unfiltered* event (1901), not the old book event (100).
    expect(page.until).toBe(1900);
  });

  it('pages a category with its own cursor and kinds filter', async () => {
    const books = Array.from({ length: 3 }, (_, i) => ev(`b${i}`, 500 - i * 10, { kind: 30040, tags: [['d', `d${i}`]] }));
    const requests = [];
    installMockWebSocket(fakeRelay([ev('n', 1000), ...books], requests));

    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.fetchCategoryEvents('books'));

    requests.length = 0;
    await act(() => result.current.loadOlderEvents('books'));
    const page = requests.find((f) => f.until !== undefined);
    expect(page.kinds).toContain(30040);
    expect(page.until).toBe(479);
  });

  it('only marks a query exhausted after a relay-confirmed empty page', async () => {
    const store = [ev('n1', 1000)];
    installMockWebSocket(fakeRelay(store, []));
    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMoreFor('all')).toBe(true);

    await act(() => result.current.loadOlderEvents('all'));
    expect(result.current.hasMoreFor('all')).toBe(false);
  });

  it('does not mark a query exhausted when relays fail', async () => {
    let healthy = true;
    installMockWebSocket((url, filter, ws) => {
      if (!healthy) {
        ws.close();
        return;
      }
      fakeRelay([ev('n1', 1000)], [])(url, filter, ws);
    });
    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    healthy = false;
    await act(() => result.current.loadOlderEvents('all'));
    expect(result.current.hasMoreFor('all')).toBe(true);
  });
});
