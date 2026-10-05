/**
 * Minimal NIP-01 relay client used by every data hook.
 *
 * `queryRelays` opens one short-lived WebSocket per relay, sends a single REQ,
 * collects EVENT frames until EOSE (or timeout) and resolves with the merged,
 * de-duplicated events.
 */

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
 * @param {{timeout?: number, signal?: AbortSignal, subPrefix?: string, accept?: (event: object) => boolean}} [options]
 *   `accept` drops events that should not be trusted (see `acceptEvent`).
 * @returns {Promise<{events: object[], ok: boolean}>} `ok` is true when at least one relay answered with EOSE.
 */
export async function queryRelays(relays, filter, options = {}) {
  const { accept, ...rest } = options;
  const results = await Promise.all(relays.map((url) => queryRelay(url, filter, rest)));

  const byId = new Map();
  let ok = false;
  for (const result of results) {
    if (result.ok) ok = true;
    for (const event of result.events) {
      if (!event || typeof event.id !== 'string' || byId.has(event.id)) continue;
      if (accept && !accept(event)) continue;
      byId.set(event.id, event);
    }
  }
  return { events: Array.from(byId.values()), ok };
}
