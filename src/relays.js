/**
 * Relay configuration.
 *
 * The client queries these relays directly; results are merged and
 * de-duplicated by `queryRelays` / `subscribeRelays` in relayClient.js.
 */

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.ditto.pub',
  'wss://relay.emre.xyz',
];

/**
 * Validates and sanitizes a WebSocket relay URL.
 *
 * @param {string} url - Relay URL to validate
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeRelayUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^wss?:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }
  return null;
}

/**
 * Returns the valid, de-duplicated relays among `relays` (trailing slashes stripped).
 *
 * @param {string[]} relays
 * @returns {string[]}
 */
export function normalizeRelays(relays) {
  if (!Array.isArray(relays)) return [];
  const seen = new Set();
  for (const relay of relays) {
    const sanitized = sanitizeRelayUrl(relay);
    if (sanitized) seen.add(sanitized);
  }
  return Array.from(seen);
}

/**
 * Retrieves the relay endpoints used for read-only queries and subscriptions.
 *
 * @returns {string[]} Array of relay URLs
 */
export function getDefaultRelays() {
  return normalizeRelays(DEFAULT_RELAYS);
}
