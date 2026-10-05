import { describe, it, expect, afterEach, vi } from 'vitest';
import { queryRelays, chunk } from '../src/relayClient.js';
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
    const { events, ok } = await queryRelays(['wss://a', 'wss://b'], { kinds: [1] });
    expect(ok).toBe(true);
    expect(events.map((e) => e.id).sort()).toEqual(['1', '2']);
  });

  it('ignores frames for other subscriptions', async () => {
    installMockWebSocket((url, filter, ws) => {
      ws.emit(['EVENT', 'someone-else', ev('x')]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { events } = await queryRelays(['wss://a'], {});
    expect(events).toEqual([]);
  });

  it('applies the accept predicate', async () => {
    installMockWebSocket((url, filter, ws) => {
      ws.emit(['EVENT', ws.subId, ev('good')]);
      ws.emit(['EVENT', ws.subId, ev('bad')]);
      ws.emit(['EOSE', ws.subId]);
    });
    const { events } = await queryRelays(['wss://a'], {}, { accept: (e) => e.id === 'good' });
    expect(events.map((e) => e.id)).toEqual(['good']);
  });

  it('reports ok=false when the relay never answers EOSE', async () => {
    vi.useFakeTimers();
    installMockWebSocket(() => {});
    const promise = queryRelays(['wss://a'], {}, { timeout: 1000 });
    await vi.advanceTimersByTimeAsync(1100);
    const { events, ok } = await promise;
    expect(ok).toBe(false);
    expect(events).toEqual([]);
  });

  it('stops when the signal is aborted', async () => {
    installMockWebSocket(() => {});
    const controller = new AbortController();
    const promise = queryRelays(['wss://a'], {}, { signal: controller.signal, timeout: 60000 });
    controller.abort();
    const { ok } = await promise;
    expect(ok).toBe(false);
  });
});
