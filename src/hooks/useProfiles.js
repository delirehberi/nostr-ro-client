import { useState, useEffect, useRef, useCallback } from 'react';

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

    const fetchPromises = relays.map((relayUrl) => {
      return new Promise((resolve) => {
        let ws;
        const subId = 'prof_' + Math.random().toString(36).slice(2, 6);
        const timer = setTimeout(() => {
          if (ws) {
            try {
              ws.close();
            } catch (_) {}
          }
          resolve();
        }, 3000);

        try {
          ws = new WebSocket(relayUrl);
          ws.onopen = () => {
            try {
              ws.send(JSON.stringify(['REQ', subId, filter]));
            } catch (_) {
              resolve();
            }
          };
          ws.onmessage = (msg) => {
            try {
              const data = JSON.parse(msg.data);
              if (data[0] === 'EVENT' && data[2]) {
                const event = data[2];
                const content = JSON.parse(event.content);
                const existingCreatedAt = profileCreatedAtMap.get(event.pubkey) || 0;
                if (event.created_at > existingCreatedAt) {
                  newProfiles.set(event.pubkey, content);
                  profileCreatedAtMap.set(event.pubkey, event.created_at);
                }
              } else if (data[0] === 'EOSE' || data[0] === 'CLOSED') {
                clearTimeout(timer);
                try {
                  ws.close();
                } catch (_) {}
                resolve();
              }
            } catch (_) {}
          };
          ws.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          ws.onclose = () => {
            clearTimeout(timer);
            resolve();
          };
        } catch (_) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    await Promise.all(fetchPromises);

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
