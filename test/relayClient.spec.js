// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { queryRelays, subscribeRelays, chunk, nextPageCursor } from '../src/relayClient.js';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { installMockWebSocket } from './helpers/mockWebSocket.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ev = (id) => ({ id, pubkey: 'a', kind: 1, created_at: 1, tags: [], content: '' });

describe('chunk', () => {
  it('splits arrays into groups of at most n', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('queryRelays', () => {
  it('collects events until EOSE and de-duplicates across relays', async () => {
    installMockWebSocket((url, filter, ws) => {
      ws.emit(['EVENT', ws.subId, ev('1')]);
      ws.emit(['EVENT', ws.subId, ev(url.endsWith('a') ? '2' : '1')]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { events, ok } = await queryRelays(['wss://a', 'wss://b'], { kinds: [1] }, { verify: false });
    expect(ok).toBe(true);
    expect(events.map((e) => e.id).sort()).toEqual(['1', '2']);
  });

  it('ignores frames for other subscriptions', async () => {
    installMockWebSocket((url, filter, ws) => {
      ws.emit(['EVENT', 'someone-else', ev('x')]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { events } = await queryRelays(['wss://a'], {}, { verify: false });
    expect(events).toEqual([]);
  });

  it('applies the accept predicate', async () => {
    installMockWebSocket((url, filter, ws) => {
      ws.emit(['EVENT', ws.subId, ev('good')]);
      ws.emit(['EVENT', ws.subId, ev('bad')]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { events } = await queryRelays(['wss://a'], {}, { verify: false, accept: (e) => e.id === 'good' });
    expect(events.map((e) => e.id)).toEqual(['good']);
  });

  it('reports ok=false when the relay never answers EOSE', async () => {
    vi.useFakeTimers();
    installMockWebSocket(() => {});
    const promise = queryRelays(['wss://a'], {}, { timeout: 1000, verify: false });
    await vi.advanceTimersByTimeAsync(1100);
    const { events, ok } = await promise;
    expect(ok).toBe(false);
    expect(events).toEqual([]);
  });

  it('stops when the signal is aborted', async () => {
    installMockWebSocket(() => {});
    const controller = new AbortController();
    const promise = queryRelays(['wss://a'], {}, { signal: controller.signal, timeout: 60000, verify: false });
    controller.abort();
    const { ok } = await promise;
    expect(ok).toBe(false);
  });
});

describe('queryRelays relay stats', () => {
  it('reports per-relay counts and oldest created_at', async () => {
    installMockWebSocket((url, filter, ws) => {
      const times = url.endsWith('a') ? [30, 20] : [25, 5, 1];
      times.forEach((t) => ws.emit(['EVENT', ws.subId, { ...ev(`${url}-${t}`), created_at: t }]));
      ws.emit(['EOSE', ws.subId]);
    });
    const { relays } = await queryRelays(['wss://a', 'wss://b'], {}, { verify: false });
    expect(relays).toEqual([
      { url: 'wss://a', ok: true, count: 2, oldest: 20 },
      { url: 'wss://b', ok: true, count: 3, oldest: 1 },
    ]);
  });
});

describe('nextPageCursor', () => {
  it('starts after the newest oldest event among relays that returned a full page', () => {
    const stats = [
      { count: 100, oldest: 900 },
      { count: 100, oldest: 100 },
      { count: 40, oldest: 5 },
    ];
    expect(nextPageCursor(stats, 100)).toBe(900);
  });

  it('uses the overall oldest event when no relay returned a full page', () => {
    expect(nextPageCursor([{ count: 3, oldest: 50 }, { count: 7, oldest: 20 }], 100)).toBe(20);
  });

  it('returns undefined when nothing came back', () => {
    expect(nextPageCursor([{ count: 0, oldest: null }], 100)).toBeUndefined();
    expect(nextPageCursor([], 100)).toBeUndefined();
  });
});

describe('queryRelays verification', () => {
  it('drops forged, wrong-author and wrong-kind events', async () => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const good = finalizeEvent({ kind: 1, created_at: 10, tags: [], content: 'hi' }, sk);
    const forged = { ...good, id: 'f'.repeat(64), content: 'tampered' };
    const tampered = { ...good, content: 'tampered' };
    const otherAuthor = finalizeEvent({ kind: 1, created_at: 11, tags: [], content: 'x' }, generateSecretKey());
    const wrongKind = finalizeEvent({ kind: 7, created_at: 12, tags: [], content: '+' }, sk);

    installMockWebSocket((url, filter, ws) => {
      [good, forged, tampered, otherAuthor, wrongKind].forEach((e) => ws.emit(['EVENT', ws.subId, e]));
      ws.emit(['EOSE', ws.subId]);
    });

    const { events } = await queryRelays(['wss://a'], { authors: [pk], kinds: [1] });
    expect(events.map((e) => e.id)).toEqual([good.id]);
  });
});

describe('subscribeRelays', () => {
  const live = (id, created_at) => ({ id, pubkey: 'a', kind: 1, created_at, tags: [], content: '' });

  it('pushes events as they arrive, once per id across relays, and drops unrelated frames', async () => {
    const sockets = installMockWebSocket();
    const received = [];
    const stop = subscribeRelays(['wss://a', 'wss://b'], { authors: ['a'], since: 100 }, { onEvent: (e) => received.push(e.id), verify: false });
    await Promise.resolve();
    await Promise.resolve();

    sockets.forEach((ws) => {
      expect(ws.sent[0][2]).toEqual({ authors: ['a'], since: 100 });
      ws.emit(['EVENT', ws.subId, live('e1', 101)]);
      ws.emit(['EVENT', 'other-sub', live('x', 102)]);
      ws.emit(['EOSE', ws.subId]);
    });
    sockets[0].emit(['EVENT', sockets[0].subId, live('e2', 103)]);

    expect(received).toEqual(['e1', 'e2']);
    stop();
  });

  it('verifies events by default', async () => {
    const sockets = installMockWebSocket();
    const received = [];
    const stop = subscribeRelays(['wss://a'], { authors: ['a'], since: 1 }, { onEvent: (e) => received.push(e.id) });
    await Promise.resolve();
    await Promise.resolve();
    sockets[0].emit(['EVENT', sockets[0].subId, live('unsigned', 5)]);
    expect(received).toEqual([]);
    stop();
  });

  it('reconnects resuming from the newest event, and resets the delay after a successful connect', async () => {
    vi.useFakeTimers();
    const sockets = installMockWebSocket();
    const stop = subscribeRelays(['wss://a'], { authors: ['a'], since: 100 }, { onEvent: () => {}, verify: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets).toHaveLength(1);

    sockets[0].emit(['EVENT', sockets[0].subId, live('e1', 150)]);
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(1999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(sockets).toHaveLength(2);
    expect(sockets[1].sent[0][2].since).toBe(150);

    // The second socket connected, so the next drop waits the base delay again
    sockets[1].close();
    await vi.advanceTimersByTimeAsync(2001);
    expect(sockets).toHaveLength(3);

    stop();
    sockets[2].close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets).toHaveLength(3);
  });

  it('backs off exponentially while a relay stays unreachable', async () => {
    vi.useFakeTimers();
    const sockets = installMockWebSocket(undefined, { autoOpen: false });
    const stop = subscribeRelays(['wss://a'], { authors: ['a'], since: 1 }, { onEvent: () => {}, verify: false });
    await vi.advanceTimersByTimeAsync(0);

    sockets[0].close();
    await vi.advanceTimersByTimeAsync(2001);
    expect(sockets).toHaveLength(2);
    sockets[1].close();
    await vi.advanceTimersByTimeAsync(3999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2);
    expect(sockets).toHaveLength(3);
    stop();
  });
});
