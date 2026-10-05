/**
 * Minimal NIP-01 relay client used by every data hook.
 *
 * `queryRelays` opens one short-lived WebSocket per relay, sends a single REQ,
 * collects EVENT frames until EOSE (or timeout) and resolves with the merged,
 * de-duplicated events.
 */

import { acceptEvent } from './eventValidation.js';

const DEFAULT_TIMEOUT_MS = 3500;

/**
 * Split an array into chunks of at most `size` items.
 *
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Query one relay with a single filter.
 *
 * @param {string} relayUrl
 * @param {object} filter
 * @param {{timeout?: number, signal?: AbortSignal, subPrefix?: string}} [options]
 * @returns {Promise<{events: object[], ok: boolean}>} `ok` is true only when the relay answered with EOSE.
 */
function queryRelay(relayUrl, filter, { timeout = DEFAULT_TIMEOUT_MS, signal, subPrefix = 'q' } = {}) {
  return new Promise((resolve) => {
    const events = [];
    const subId = `${subPrefix}_${Math.random().toString(36).slice(2, 8)}`;
    let ws;
    let settled = false;
    let ok = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', finish);
      try {
        ws && ws.close();
      } catch (_) {}
      resolve({ events, ok });
    };

    const timer = setTimeout(finish, timeout);
    if (signal) {
      if (signal.aborted) {
        finish();
        return;
      }
      signal.addEventListener('abort', finish);
    }

    try {
      ws = new WebSocket(relayUrl);
      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(['REQ', subId, filter]));
        } catch (_) {
          finish();
        }
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[1] !== subId) return;
          if (data[0] === 'EVENT' && data[2]) {
            events.push(data[2]);
          } else if (data[0] === 'EOSE') {
            ok = true;
            finish();
          } else if (data[0] === 'CLOSED') {
            finish();
          }
        } catch (_) {}
      };
      ws.onerror = finish;
      ws.onclose = finish;
    } catch (_) {
      finish();
    }
  });
}

/**
 * Query every relay with the same filter and merge the results.
 *
 * @param {string[]} relays
 * @param {object} filter
 * @param {{timeout?: number, signal?: AbortSignal, subPrefix?: string, verify?: boolean, accept?: (event: object) => boolean}} [options]
 *   By default every event must match the filter's authors/kinds/ids and carry a valid
 *   signature (see `acceptEvent`); pass `verify: false` to skip that. `accept` is an extra predicate.
 * @returns {Promise<{events: object[], ok: boolean, relays: {url: string, ok: boolean, count: number, oldest: number|null}[]}>}
 *   `ok` is true when at least one relay answered with EOSE. `relays` reports, per relay, how many
 *   accepted events it sent and the oldest `created_at` among them (used for paging, see `nextPageCursor`).
 */
export async function queryRelays(relays, filter, options = {}) {
  const { accept, verify = true, ...rest } = options;
  const results = await Promise.all(relays.map((url) => queryRelay(url, filter, rest)));

  const byId = new Map();
  let ok = false;
  const stats = results.map((result, i) => {
    if (result.ok) ok = true;
    let count = 0;
    let oldest = null;
    for (const event of result.events) {
      if (!event || typeof event.id !== 'string') continue;
      if (!byId.has(event.id)) {
        if (verify && !acceptEvent(event, filter)) continue;
        if (accept && !accept(event)) continue;
        byId.set(event.id, event);
      }
      count++;
      if (typeof event.created_at === 'number' && (oldest === null || event.created_at < oldest)) {
        oldest = event.created_at;
      }
    }
    return { url: relays[i], ok: result.ok, count, oldest };
  });
  return { events: Array.from(byId.values()), ok, relays: stats };
}

/**
 * The `until` cursor for the next page after a `queryRelays` call with `limit`.
 *
 * Each relay answers `limit` on its own, so their pages can cover very
 * different time ranges. Only relays that returned a full page may have older
 * events, and everything newer than the *newest* of their oldest events has
 * been seen from all of them, so that is where the next page starts. When no
 * relay returned a full page, every relay sent all it had, and the oldest event
 * overall is used (the next page then confirms the end).
 *
 * @param {{count: number, oldest: number|null}[]} relayStats
 * @param {number} limit
 * @returns {number|undefined} undefined when no relay returned anything.
 */
export function nextPageCursor(relayStats, limit) {
  const withEvents = (relayStats || []).filter((r) => r.count > 0 && r.oldest !== null);
  if (withEvents.length === 0) return undefined;
  const full = withEvents.filter((r) => r.count >= limit);
  if (full.length > 0) return Math.max(...full.map((r) => r.oldest));
  return Math.min(...withEvents.map((r) => r.oldest));
}

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 30000;

/**
 * Keep a live subscription open on every relay.
 *
 * Each relay gets one WebSocket that stays open after EOSE so new events are
 * pushed as they are published. If a socket drops it reconnects with
 * exponential backoff, asking only for events newer than the last one seen so
 * nothing is missed or replayed. Events are verified like `queryRelays` does
 * and de-duplicated across relays and reconnects.
 *
 * @param {string[]} relays
 * @param {object} filter - Should include `since` to avoid replaying history.
 * @param {{onEvent: (event: object) => void, verify?: boolean, subPrefix?: string}} options
 * @returns {() => void} Unsubscribe; closes every socket and cancels reconnects.
 */
export function subscribeRelays(relays, filter, { onEvent, verify = true, subPrefix = 'live' } = {}) {
  const seen = new Set();
  const closers = [];
  let stopped = false;
  let lastCreatedAt = filter.since ?? 0;

  const subscribeOne = (relayUrl) => {
    let ws;
    let timer = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    const connect = () => {
      if (stopped) return;
      const subId = `${subPrefix}_${Math.random().toString(36).slice(2, 8)}`;
      const reqFilter = lastCreatedAt ? { ...filter, since: lastCreatedAt } : filter;

      try {
        ws = new WebSocket(relayUrl);
      } catch (_) {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        delay = RECONNECT_BASE_DELAY_MS;
        try {
          ws.send(JSON.stringify(['REQ', subId, reqFilter]));
        } catch (_) {}
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[0] !== 'EVENT' || data[1] !== subId || !data[2]) return;
          const event = data[2];
          if (typeof event.id !== 'string' || seen.has(event.id)) return;
          if (verify && !acceptEvent(event, filter)) return;
          seen.add(event.id);
          if (event.created_at > lastCreatedAt) lastCreatedAt = event.created_at;
          onEvent(event);
        } catch (_) {}
      };
      ws.onerror = () => {};
      ws.onclose = scheduleReconnect;
    };

    function scheduleReconnect() {
      if (stopped || timer) return;
      timer = setTimeout(() => {
        timer = null;
        connect();
      }, delay);
      delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS);
    }

    closers.push(() => {
      clearTimeout(timer);
      timer = null;
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch (_) {}
      }
    });

    connect();
  };

  relays.forEach(subscribeOne);

  return () => {
    stopped = true;
    closers.forEach((close) => close());
  };
}
