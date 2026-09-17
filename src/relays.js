/**
 * Nostr Relay Configuration & Cache Relay Utilities
 *
 * Configures the centralized read-only cache relay (wss://cache.nostr.org.tr)
 * which aggregates, caches, and proxies queries to specified upstream relays.
 */

export const DEFAULT_CACHE_RELAY_BASE = 'wss://cache.nostr.org.tr';

export const DEFAULT_UPSTREAM_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.ditto.pub',
  'wss://nostr-pub.wellorder.net',
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
 * Constructs a cache relay URL formatted with upstream relays query parameter.
 * Example: wss://cache.nostr.org.tr?relays=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net
 *
 * @param {string[]} [upstreamRelays=DEFAULT_UPSTREAM_RELAYS] - Array of upstream WebSocket relay URLs
 * @param {string} [cacheBase=DEFAULT_CACHE_RELAY_BASE] - Base URL of the cache relay
 * @returns {string} Fully qualified cache relay endpoint URL
 */
export function buildCacheRelayUrl(
  upstreamRelays = DEFAULT_UPSTREAM_RELAYS,
  cacheBase = DEFAULT_CACHE_RELAY_BASE
) {
  const base = sanitizeRelayUrl(cacheBase) || DEFAULT_CACHE_RELAY_BASE;

  if (!Array.isArray(upstreamRelays) || upstreamRelays.length === 0) {
    return base;
  }

  const validRelays = [];
  const seen = new Set();

  for (const relay of upstreamRelays) {
    const sanitized = sanitizeRelayUrl(relay);
    if (sanitized && !seen.has(sanitized)) {
      seen.add(sanitized);
      validRelays.push(sanitized);
    }
  }

  if (validRelays.length === 0) {
    return base;
  }

  return `${base}?relays=${validRelays.join(',')}`;
}

/**
 * Retrieves the default array of relay endpoints for read-only subscriptions.
 * Returns an array containing the unified cache relay endpoint.
 *
 * @returns {string[]} Array of active relay URLs
 */
export function getDefaultRelays() {
  return [buildCacheRelayUrl(DEFAULT_UPSTREAM_RELAYS, DEFAULT_CACHE_RELAY_BASE)];
}
