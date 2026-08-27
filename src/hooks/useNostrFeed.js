import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { classifyEvent } from '../kinds.js';

const CATEGORY_KINDS_MAP = {
  books: [30040, 30041, 30001, 30003, 1985],
  movies: [30001, 30003, 1985, 31922, 31923, 31989],
  media: [20, 21, 22, 1063, 1],
  lists: [30000, 30001, 30002, 30003, 30004, 30005, 10000, 10001, 10002, 10003],
  notes: [1, 6, 16, 1111],
  articles: [30023, 30024],
  highlights: [9802],
};

export function useNostrFeed(pubkey, relays = [], onRequestProfiles) {
  const [events, setEvents] = useState([]);
  const [eventMap, setEventMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const eventMapRef = useRef(new Map());
  const fetchedParentIdsRef = useRef(new Set());
  const oldestTimestampRef = useRef(Infinity);

  const fetchParents = useCallback(
    async (parentIds) => {
      const needed = parentIds.filter(
        (id) => !eventMapRef.current.has(id) && !fetchedParentIdsRef.current.has(id)
      );
      if (needed.length === 0 || relays.length === 0) return;

      needed.forEach((id) => fetchedParentIdsRef.current.add(id));

      const filter = {
        ids: needed.slice(0, 50),
      };

      const parentEvents = [];
      const fetchPromises = relays.map((relayUrl) => {
        return new Promise((resolve) => {
          let ws;
          const subId = 'par_' + Math.random().toString(36).slice(2, 6);
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
                  parentEvents.push(data[2]);
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

      if (parentEvents.length > 0) {
        const authorPubkeys = [];
        setEventMap((prev) => {
          const next = new Map(prev);
          parentEvents.forEach((p) => {
            next.set(p.id, p);
            eventMapRef.current.set(p.id, p);
            if (p.pubkey) authorPubkeys.push(p.pubkey);
          });
          return next;
        });
        if (onRequestProfiles && authorPubkeys.length > 0) {
          onRequestProfiles(authorPubkeys);
        }
      }
    },
    [relays, onRequestProfiles]
  );

  const processNewEvents = useCallback(
    (newEventsList) => {
      const pubkeysToRequest = [];
      const parentIdsToRequest = [];

      newEventsList.forEach((e) => {
        if (!eventMapRef.current.has(e.id)) {
          eventMapRef.current.set(e.id, e);
          if (e.created_at < oldestTimestampRef.current) {
            oldestTimestampRef.current = e.created_at;
          }
        }
        if (e.pubkey) pubkeysToRequest.push(e.pubkey);

        // Check if Repost (Kind 6 or 16) with embedded event JSON in content
        if ((e.kind === 6 || e.kind === 16) && e.content && e.content.trim().startsWith('{')) {
          try {
            const innerEvent = JSON.parse(e.content);
            if (innerEvent && innerEvent.id && innerEvent.pubkey) {
              if (!eventMapRef.current.has(innerEvent.id)) {
                eventMapRef.current.set(innerEvent.id, innerEvent);
              }
              pubkeysToRequest.push(innerEvent.pubkey);
              if (Array.isArray(innerEvent.tags)) {
                innerEvent.tags.forEach((tag) => {
                  if (tag[0] === 'p' && tag[1]) pubkeysToRequest.push(tag[1]);
                  if (tag[0] === 'e' && tag[1] && tag[1] !== innerEvent.id) parentIdsToRequest.push(tag[1]);
                });
              }
            }
          } catch (_) {}
        }

        // Find mentioned pubkeys or parent events
        if (Array.isArray(e.tags)) {
          e.tags.forEach((tag) => {
            if (tag[0] === 'p' && tag[1]) {
              pubkeysToRequest.push(tag[1]);
            }
            if (tag[0] === 'e' && tag[1] && tag[1] !== e.id) {
              parentIdsToRequest.push(tag[1]);
            }
          });
        }
      });

      const sorted = Array.from(eventMapRef.current.values()).sort(
        (a, b) => b.created_at - a.created_at
      );

      setEvents(sorted);
      setEventMap(new Map(eventMapRef.current));

      if (onRequestProfiles && pubkeysToRequest.length > 0) {
        onRequestProfiles(pubkeysToRequest);
      }

      if (parentIdsToRequest.length > 0) {
        fetchParents(parentIdsToRequest);
      }
    },
    [onRequestProfiles, fetchParents]
  );

  // Initial Fetch
  useEffect(() => {
    if (!pubkey || relays.length === 0) return;

    let isMounted = true;
    setIsLoading(true);

    const filter = {
      authors: [pubkey],
      limit: 100,
    };

    const incomingEvents = new Map();
    const fetchPromises = relays.map((relayUrl) => {
      return new Promise((resolve) => {
        let ws;
        const subId = 'init_' + Math.random().toString(36).slice(2, 6);
        const timer = setTimeout(() => {
          if (ws) {
            try {
              ws.close();
            } catch (_) {}
          }
          resolve();
        }, 3500);

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
                incomingEvents.set(data[2].id, data[2]);
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

    Promise.all(fetchPromises).then(() => {
      if (!isMounted) return;
      processNewEvents(Array.from(incomingEvents.values()));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [pubkey, relays, processNewEvents]);

  // Load More (Infinite Scroll)
  const loadOlderEvents = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMore ||
      oldestTimestampRef.current === Infinity ||
      !pubkey ||
      relays.length === 0
    ) {
      return;
    }

    setIsLoadingMore(true);

    const filter = {
      authors: [pubkey],
      until: oldestTimestampRef.current - 1,
      limit: 50,
    };

    const incomingEvents = new Map();
    const fetchPromises = relays.map((relayUrl) => {
      return new Promise((resolve) => {
        let ws;
        const subId = 'more_' + Math.random().toString(36).slice(2, 6);
        const timer = setTimeout(() => {
          if (ws) {
            try {
              ws.close();
            } catch (_) {}
          }
          resolve();
        }, 3500);

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
                incomingEvents.set(data[2].id, data[2]);
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

    const newItems = Array.from(incomingEvents.values());
    if (newItems.length === 0) {
      setHasMore(false);
    } else {
      processNewEvents(newItems);
    }

    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, pubkey, relays, processNewEvents]);

  // Fetch Category Specifically
  const fetchCategoryEvents = useCallback(
    async (category) => {
      const kinds = CATEGORY_KINDS_MAP[category];
      if (!kinds || kinds.length === 0 || !pubkey || relays.length === 0) return;

      const filter = {
        authors: [pubkey],
        kinds,
        limit: 100,
      };

      const incomingEvents = new Map();
      const fetchPromises = relays.map((relayUrl) => {
        return new Promise((resolve) => {
          let ws;
          const subId = 'cat_' + category + '_' + Math.random().toString(36).slice(2, 6);
          const timer = setTimeout(() => {
            if (ws) {
              try {
                ws.close();
              } catch (_) {}
            }
            resolve();
          }, 3500);

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
                  incomingEvents.set(data[2].id, data[2]);
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
      if (incomingEvents.size > 0) {
        processNewEvents(Array.from(incomingEvents.values()));
      }
    },
    [pubkey, relays, processNewEvents]
  );

  // Calculate live category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: events.length };
    events.forEach((e) => {
      const { category } = classifyEvent(e);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [events]);

  return {
    events,
    eventMap,
    isLoading,
    isLoadingMore,
    hasMore,
    categoryCounts,
    loadOlderEvents,
    fetchCategoryEvents,
  };
}

export default useNostrFeed;
