import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CACHE_RELAY_BASE,
  DEFAULT_UPSTREAM_RELAYS,
  sanitizeRelayUrl,
  buildCacheRelayUrl,
  getDefaultRelays,
} from '../src/relays.js';

describe('relays configuration and cache relay builder', () => {
  describe('sanitizeRelayUrl', () => {
    it('sanitizes valid wss:// and ws:// URLs', () => {
      expect(sanitizeRelayUrl('wss://relay.damus.io')).toBe('wss://relay.damus.io');
      expect(sanitizeRelayUrl('wss://nos.lol/')).toBe('wss://nos.lol');
      expect(sanitizeRelayUrl('  ws://localhost:8080/  ')).toBe('ws://localhost:8080');
    });

    it('rejects invalid or non-websocket URLs', () => {
      expect(sanitizeRelayUrl('')).toBeNull();
      expect(sanitizeRelayUrl('http://example.com')).toBeNull();
      expect(sanitizeRelayUrl('https://example.com')).toBeNull();
      expect(sanitizeRelayUrl(null)).toBeNull();
      expect(sanitizeRelayUrl(undefined)).toBeNull();
      expect(sanitizeRelayUrl(12345)).toBeNull();
    });
  });

  describe('buildCacheRelayUrl', () => {
    it('builds cache relay URL with comma-separated upstream relays', () => {
      const upstreams = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.primal.net',
      ];
      const url = buildCacheRelayUrl(upstreams, 'wss://cache.nostr.org.tr');
      expect(url).toBe(
        'wss://cache.nostr.org.tr?relays=wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
      );
    });

    it('uses DEFAULT_UPSTREAM_RELAYS and DEFAULT_CACHE_RELAY_BASE when arguments are omitted', () => {
      const url = buildCacheRelayUrl();
      expect(url).toContain('wss://cache.nostr.org.tr?relays=');
      for (const upstream of DEFAULT_UPSTREAM_RELAYS) {
        expect(url).toContain(upstream);
      }
    });

    it('deduplicates upstream relays and strips trailing slashes', () => {
      const upstreams = [
        'wss://relay.damus.io/',
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://nos.lol/',
      ];
      const url = buildCacheRelayUrl(upstreams);
      expect(url).toBe('wss://cache.nostr.org.tr?relays=wss://relay.damus.io,wss://nos.lol');
    });

    it('returns base cache relay URL if no valid upstream relays provided', () => {
      expect(buildCacheRelayUrl([])).toBe(DEFAULT_CACHE_RELAY_BASE);
      expect(buildCacheRelayUrl(['invalid-url', 'http://not-ws'])).toBe(DEFAULT_CACHE_RELAY_BASE);
    });
  });

  describe('getDefaultRelays', () => {
    it('returns array with a single unified cache relay URL', () => {
      const relays = getDefaultRelays();
      expect(Array.isArray(relays)).toBe(true);
      expect(relays.length).toBe(1);
      expect(relays[0].startsWith('wss://cache.nostr.org.tr?relays=')).toBe(true);
    });
  });
});
