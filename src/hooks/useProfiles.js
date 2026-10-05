import { useState, useRef, useCallback } from 'react';
import { queryRelays } from '../relayClient.js';

export function useProfiles(relays = []) {
  const [profileMap, setProfileMap] = useState(() => new Map());
  const pendingPubkeysRef = useRef(new Set());
  const fetchedPubkeysRef = useRef(new Set());
  const debounceTimerRef = useRef(null);

  const fetchProfilesBatch = useCallback(async (pubkeysToFetch) => {
    if (pubkeysToFetch.length === 0 || relays.length === 0) return;

    pubkeysToFetch.forEach((pk) => fetchedPubkeysRef.current.add(pk));

    const filter = {
      kinds: [0],
      authors: pubkeysToFetch.slice(0, 50),
    };

    const newProfiles = new Map();
    const profileCreatedAtMap = new Map();

    const { events } = await queryRelays(relays, filter, { timeout: 3000, subPrefix: 'prof' });
    for (const event of events) {
      let content;
      try {
        content = JSON.parse(event.content);
      } catch (_) {
        continue;
      }
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
