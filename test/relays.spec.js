import { describe, it, expect } from 'vitest';
import { DEFAULT_RELAYS, sanitizeRelayUrl, normalizeRelays, getDefaultRelays } from '../src/relays.js';

describe('relays configuration', () => {
  describe('sanitizeRelayUrl', () => {
    it('sanitizes valid wss:// and ws:// URLs', () => {
      expect(sanitizeRelayUrl('wss://relay.damus.io')).toBe('wss://relay.damus.io');
      expect(sanitizeRelayUrl('wss://relay.emre.xyz/')).toBe('wss://relay.emre.xyz');
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

  describe('normalizeRelays', () => {
    it('drops invalid entries, strips trailing slashes and de-duplicates', () => {
      expect(
        normalizeRelays(['wss://a.io/', 'wss://a.io', 'http://nope', 'bad', 'wss://b.io'])
      ).toEqual(['wss://a.io', 'wss://b.io']);
    });

    it('returns an empty array for non-arrays', () => {
      expect(normalizeRelays(undefined)).toEqual([]);
    });
  });

  describe('getDefaultRelays', () => {
    it('uses damus, primal, ditto and relay.emre.xyz directly', () => {
      expect(getDefaultRelays()).toEqual([
        'wss://relay.damus.io',
        'wss://relay.primal.net',
        'wss://relay.ditto.pub',
        'wss://relay.emre.xyz',
      ]);
    });

    it('only contains valid websocket URLs and no cache relay', () => {
      for (const relay of DEFAULT_RELAYS) expect(sanitizeRelayUrl(relay)).toBe(relay);
      expect(getDefaultRelays().join(' ')).not.toContain('cache.nostr');
    });
  });
});
