import { useState, useRef, useCallback } from 'react';
import { queryRelays, chunk } from '../relayClient.js';

const MAX_AUTHORS_PER_REQUEST = 50;

export function useProfiles(relays = []) {
  const [profileMap, setProfileMap] = useState(() => new Map());
  const pendingPubkeysRef = useRef(new Set());
  const fetchedPubkeysRef = useRef(new Set());
  const debounceTimerRef = useRef(null);

  const fetchProfilesBatch = useCallback(async (pubkeysToFetch) => {
    if (pubkeysToFetch.length === 0 || relays.length === 0) return;

    pubkeysToFetch.forEach((pk) => fetchedPubkeysRef.current.add(pk));

    const newProfiles = new Map();
    const profileCreatedAtMap = new Map();

    const results = await Promise.all(
      chunk(pubkeysToFetch, MAX_AUTHORS_PER_REQUEST).map(async (authors) => {
        const { events, ok } = await queryRelays(
          relays,
          { kinds: [0], authors },
          { timeout: 3000, subPrefix: 'prof' }
        );
        // Let pubkeys from a failed request be retried by a later call.
        if (!ok) authors.forEach((pk) => fetchedPubkeysRef.current.delete(pk));
        return events;
      })
    );
    const events = results.flat();
    for (const event of events) {
      let content;
      try {
        content = JSON.parse(event.content);
      } catch (_) {
        continue;
      }
      if (!content || typeof content !== 'object') continue;
      const existingCreatedAt = profileCreatedAtMap.get(event.pubkey) || 0;
      if (event.created_at > existingCreatedAt) {
        newProfiles.set(event.pubkey, content);
        profileCreatedAtMap.set(event.pubkey, event.created_at);
      }
    }

    if (newProfiles.size > 0) {
      setProfileMap((prev) => {
        const next = new Map(prev);
        newProfiles.forEach((val, key) => {
          next.set(key, val);
        });
        return next;
      });
    }
  }, [relays]);

  const requestProfiles = useCallback((pubkeys = []) => {
    let hasNew = false;
    pubkeys.forEach((pk) => {
      if (pk && !fetchedPubkeysRef.current.has(pk) && !pendingPubkeysRef.current.has(pk)) {
        pendingPubkeysRef.current.add(pk);
        hasNew = true;
      }
    });

    if (hasNew) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const toFetch = Array.from(pendingPubkeysRef.current);
        pendingPubkeysRef.current.clear();
        fetchProfilesBatch(toFetch);
      }, 200);
    }
  }, [fetchProfilesBatch]);

  return { profileMap, requestProfiles };
}

export default useProfiles;
