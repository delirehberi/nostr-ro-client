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
      if (filter.since !== undefined && e.created_at < filter.since) return false;
      return true;
    });
    matches = matches.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit ?? 1000);
    matches.forEach((e) => ws.emit(['EVENT', ws.subId, e]));
    ws.emit(['EOSE', ws.subId]);
  };
}

const relays = ['wss://r'];
const twoRelays = ['wss://a', 'wss://b'];

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

  it('adds events published after load via the live subscription', async () => {
    const sockets = installMockWebSocket(fakeRelay([ev('old', 100)], []));
    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The live socket is the one whose REQ carries `since`
    await waitFor(() => expect(sockets.some((ws) => ws.sent[0]?.[2]?.since !== undefined && !ws.closed)).toBe(true));
    const liveSocket = sockets.find((ws) => ws.sent[0][2].since !== undefined && !ws.closed);
    expect(liveSocket.sent[0][2].since).toBe(100);

    act(() => liveSocket.emit(['EVENT', liveSocket.subId, ev('fresh', 200)]));
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['fresh', 'old']));
    expect(result.current.categoryCounts.all).toBe(2);
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

  it('pages from the newest cursor among full relays so no relay range is skipped', async () => {
    // Relay A has dense recent posts, relay B has sparse posts going back much further.
    const storeA = Array.from({ length: 150 }, (_, i) => ev(`a${i}`, 10000 - i));
    const storeB = Array.from({ length: 150 }, (_, i) => ev(`b${i}`, 9999 - i * 50));
    const requests = [];
    installMockWebSocket((url, filter, ws) => fakeRelay(url.endsWith('a') ? storeA : storeB, requests)(url, filter, ws));

    const { result } = renderHook(() => useNostrFeed(OWNER, twoRelays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    requests.length = 0;
    await act(() => result.current.loadOlderEvents('all'));
    const page = requests.find((f) => f.until !== undefined);
    // A's 100th post is at 9901; B's reaches back to 5049. Paging from 5048 would skip a100..a149.
    expect(page.until).toBe(9900);
    expect(result.current.eventMap.has('a149')).toBe(true);
  });

  it('only lists the newest version of an addressable event', async () => {
    const older = ev('list-old', 100, { kind: 30001, tags: [['d', 'books-read']] });
    const newer = ev('list-new', 200, { kind: 30001, tags: [['d', 'books-read']] });
    const other = ev('list-other', 150, { kind: 30001, tags: [['d', 'books-to-read']] });
    installMockWebSocket((url, filter, ws) =>
      fakeRelay(url.endsWith('a') ? [older, other] : [newer], [])(url, filter, ws)
    );

    const { result } = renderHook(() => useNostrFeed(OWNER, twoRelays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events.map((e) => e.id)).toEqual(['list-new', 'list-other']);
    expect(result.current.categoryCounts.all).toBe(2);
    // The old version is still available by id.
    expect(result.current.eventMap.has('list-old')).toBe(true);
  });

  it('keeps the newest version when an older one arrives later', async () => {
    const newer = ev('v2', 200, { kind: 10003 });
    const sockets = installMockWebSocket(fakeRelay([newer], []));
    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(sockets.some((ws) => ws.sent[0]?.[2]?.since !== undefined && !ws.closed)).toBe(true));
    const live = sockets.find((ws) => ws.sent[0][2].since !== undefined && !ws.closed);

    act(() => live.emit(['EVENT', live.subId, ev('v1', 100, { kind: 10003 })]));
    await waitFor(() => expect(result.current.eventMap.has('v1')).toBe(true));
    expect(result.current.events.map((e) => e.id)).toEqual(['v2']);
  });

  it('hides events deleted by the owner (NIP-09) and the deletion itself', async () => {
    const store = [
      ev('keep', 300),
      ev('gone', 200),
      ev('list', 150, { kind: 30001, tags: [['d', 'movies-watched']] }),
      ev('del', 400, { kind: 5, tags: [['e', 'gone'], ['a', `30001:${OWNER}:movies-watched`]] }),
    ];
    const requests = [];
    installMockWebSocket(fakeRelay(store, requests));

    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requests.some((f) => f.kinds?.includes(5))).toBe(true);
    expect(result.current.events.map((e) => e.id)).toEqual(['keep']);
    expect(result.current.categoryCounts.all).toBe(1);
    expect(result.current.eventMap.has('gone')).toBe(false);
  });

  it('applies a deletion that arrives on the live subscription', async () => {
    const sockets = installMockWebSocket(fakeRelay([ev('post', 100)], []));
    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['post']));
    await waitFor(() => expect(sockets.some((ws) => ws.sent[0]?.[2]?.since !== undefined && !ws.closed)).toBe(true));
    const live = sockets.find((ws) => ws.sent[0][2].since !== undefined && !ws.closed);

    act(() => live.emit(['EVENT', live.subId, ev('del', 200, { kind: 5, tags: [['e', 'post']] })]));
    await waitFor(() => expect(result.current.events).toEqual([]));
  });

  it('ignores deletions of other authors\' events and newer versions of a deleted address', async () => {
    const parent = ev('parent', 50, { pubkey: OTHER });
    const store = [
      parent,
      ev('reply', 100, { tags: [['e', 'parent']] }),
      ev('list-v2', 500, { kind: 30001, tags: [['d', 'x']] }),
      ev('del', 300, { kind: 5, tags: [['e', 'parent'], ['a', `30001:${OWNER}:x`]] }),
    ];
    installMockWebSocket(fakeRelay(store, []));

    const { result } = renderHook(() => useNostrFeed(OWNER, relays));
    await waitFor(() => expect(result.current.eventMap.has('parent')).toBe(true));
    expect(result.current.events.map((e) => e.id)).toEqual(['list-v2', 'reply']);
  });
});
