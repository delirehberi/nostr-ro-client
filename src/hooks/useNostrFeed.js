import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { classifyEvent, eventAddress, isNewerVersion } from '../kinds.js';
import { queryRelays, subscribeRelays, chunk, nextPageCursor } from '../relayClient.js';
import { acceptEvent } from '../eventValidation.js';

const CATEGORY_KINDS_MAP = {
  books: [30040, 30041, 30001, 30003, 1985],
  movies: [30001, 30003, 1985, 31922, 31923, 31989],
  media: [20, 21, 22, 1063, 1],
  lists: [30000, 30001, 30002, 30003, 30004, 30005, 10000, 10001, 10002, 10003],
  notes: [1, 6, 16, 1111],
  articles: [30023, 30024],
  highlights: [9802],
};

const MAX_IDS_PER_REQUEST = 50;
const INITIAL_LIMIT = 100;
const PAGE_LIMIT = 50;
const DELETION_LIMIT = 500;

/**
 * Ids of events hidden by NIP-09 deletion requests (kind 5) found in `events`.
 * `e` tags delete one event; `a` tags delete every version of an address up to
 * the request's `created_at`. A request only counts against its own author's events.
 *
 * @param {Iterable<object>} events
 * @returns {Set<string>}
 */
export function deletedEventIds(events) {
  const all = Array.from(events);
  const deletedIds = new Map(); // event id -> deleter pubkey
  const deletedAddresses = new Map(); // address -> newest deletion created_at
  all.forEach((e) => {
    if (e.kind !== 5 || !Array.isArray(e.tags)) return;
    e.tags.forEach((tag) => {
      if (!Array.isArray(tag) || !tag[1]) return;
      if (tag[0] === 'e') {
        deletedIds.set(tag[1], e.pubkey);
      } else if (tag[0] === 'a') {
        const [kind, author] = tag[1].split(':');
        if (author !== e.pubkey) return;
        // Plain replaceable kinds have no d tag: `10003:pubkey` (sometimes written with a trailing colon).
        const address = Number(kind) >= 30000 && Number(kind) < 40000 ? tag[1] : `${kind}:${author}`;
        const prev = deletedAddresses.get(address);
        if (prev === undefined || e.created_at > prev) deletedAddresses.set(address, e.created_at);
      }
    });
  });

  const hidden = new Set();
  all.forEach((e) => {
    if (deletedIds.has(e.id) && deletedIds.get(e.id) === e.pubkey) hidden.add(e.id);
    const address = eventAddress(e);
    if (address && deletedAddresses.has(address) && e.created_at <= deletedAddresses.get(address)) {
      hidden.add(e.id);
    }
  });
  return hidden;
}

export function useNostrFeed(pubkey, relays = [], onRequestProfiles) {
  const [events, setEvents] = useState([]);
  const [eventMap, setEventMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(() => new Set());

  const eventMapRef = useRef(new Map());
  const fetchedParentIdsRef = useRef(new Set());
  // Oldest created_at seen per paging query ('all' or a category), used as the `until` cursor.
  const cursorsRef = useRef(new Map());

  const fetchParents = useCallback(
    async (parentIds) => {
      const needed = Array.from(new Set(parentIds)).filter(
        (id) => !eventMapRef.current.has(id) && !fetchedParentIdsRef.current.has(id)
      );
      if (needed.length === 0 || relays.length === 0) return;

      needed.forEach((id) => fetchedParentIdsRef.current.add(id));

      const results = await Promise.all(
        chunk(needed, MAX_IDS_PER_REQUEST).map(async (ids) => {
          const { events, ok } = await queryRelays(relays, { ids }, { timeout: 3000, subPrefix: 'par' });
          // Let ids from a failed request be retried by a later call.
          if (!ok) ids.forEach((id) => fetchedParentIdsRef.current.delete(id));
          return events;
        })
      );
      const parentEvents = results.flat();

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

  /**
   * Merge events into eventMap and rebuild the feed. `cursorKey`/`cursor` set the
   * `until` cursor of the paging query ('all' or a category) the events came from.
   */
  const processNewEvents = useCallback(
    (newEventsList, cursorKey = null, cursor = undefined) => {
      const pubkeysToRequest = [];
      const parentIdsToRequest = [];

      if (cursorKey && cursor !== undefined) {
        const current = cursorsRef.current.get(cursorKey);
        if (current === undefined || cursor < current) cursorsRef.current.set(cursorKey, cursor);
      }

      newEventsList.forEach((e) => {
        if (!eventMapRef.current.has(e.id)) {
          eventMapRef.current.set(e.id, e);
        }
        if (e.pubkey) pubkeysToRequest.push(e.pubkey);
        // Deletion requests only reference what they delete; don't fetch it.
        if (e.kind === 5) return;

        // Check if Repost (Kind 6 or 16) with embedded event JSON in content
        if ((e.kind === 6 || e.kind === 16) && e.content && e.content.trim().startsWith('{')) {
          try {
            const innerEvent = JSON.parse(e.content);
            if (acceptEvent(innerEvent)) {
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

        // Find mentioned pubkeys, parent events, quotes, or reaction targets
        if (Array.isArray(e.tags)) {
          e.tags.forEach((tag) => {
            if (tag[0] === 'p' && tag[1]) {
              pubkeysToRequest.push(tag[1]);
            }
            if ((tag[0] === 'e' || tag[0] === 'q') && tag[1] && tag[1] !== e.id) {
              parentIdsToRequest.push(tag[1]);
            }
          });
        }

        // Find inline quoted event mentions (nostr:nevent1... / nostr:note1...)
        if (e.content && typeof e.content === 'string') {
          const mentionMatches = e.content.match(/(?:nostr:)?\b((?:nevent|note)1[0-9a-z]{20,})\b/g);
          if (mentionMatches) {
            mentionMatches.forEach((m) => {
              const clean = m.replace(/^nostr:/, '');
              try {
                const decoded = nip19.decode(clean);
                if (decoded.type === 'note' && decoded.data && decoded.data !== e.id) {
                  parentIdsToRequest.push(decoded.data);
                } else if (decoded.type === 'nevent' && decoded.data?.id && decoded.data.id !== e.id) {
                  parentIdsToRequest.push(decoded.data.id);
                  if (decoded.data.author) pubkeysToRequest.push(decoded.data.author);
                }
              } catch (_) {}
            });
          }
        }
      });

      // The feed only lists the owner's events; everything else (reply parents,
      // quotes, reposted notes) stays in eventMap purely for lookups. Replaceable
      // and addressable events only show their newest version, and events removed
      // by a deletion request (kind 5) are hidden everywhere.
      const all = Array.from(eventMapRef.current.values());
      const deleted = deletedEventIds(all);
      const latestByAddress = new Map();
      all.forEach((e) => {
        if (deleted.has(e.id)) return;
        const address = eventAddress(e);
        if (!address) return;
        const current = latestByAddress.get(address);
        if (!current || isNewerVersion(e, current)) latestByAddress.set(address, e);
      });

      const sorted = all
        .filter((e) => {
          if (e.pubkey !== pubkey || e.kind === 5 || deleted.has(e.id)) return false;
          const address = eventAddress(e);
          return !address || latestByAddress.get(address) === e;
        })
        .sort((a, b) => b.created_at - a.created_at);

      // Older versions stay reachable by id (e.g. an `e` reference to a specific version).
      const visibleMap = new Map(eventMapRef.current);
      deleted.forEach((id) => visibleMap.delete(id));

      setEvents(sorted);
      setEventMap(visibleMap);

      if (onRequestProfiles && pubkeysToRequest.length > 0) {
        onRequestProfiles(pubkeysToRequest);
      }

      if (parentIdsToRequest.length > 0) {
        fetchParents(parentIdsToRequest);
      }
    },
    [pubkey, onRequestProfiles, fetchParents]
  );

  // Initial Fetch
  useEffect(() => {
    if (!pubkey || relays.length === 0) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const filter = {
      authors: [pubkey],
      limit: INITIAL_LIMIT,
    };

    Promise.all([
      queryRelays(relays, filter, { subPrefix: 'init' }),
      // Deletion requests are rarely in the newest page, but they hide older events.
      queryRelays(relays, { authors: [pubkey], kinds: [5], limit: DELETION_LIMIT }, { subPrefix: 'del' }),
    ]).then(([{ events: incoming, ok, relays: relayStats }, { events: deletions }]) => {
      if (!isMounted) return;
      processNewEvents([...deletions, ...incoming], 'all', nextPageCursor(relayStats, INITIAL_LIMIT));
      if (!ok && incoming.length === 0) {
        setError('Could not reach the Nostr relays.');
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [pubkey, relays, processNewEvents, attempt]);

  // Live updates: once the initial page is in, keep a subscription open for new events.
  useEffect(() => {
    if (!pubkey || relays.length === 0 || isLoading) return;

    let newest = 0;
    eventMapRef.current.forEach((e) => {
      if (e.pubkey === pubkey && e.created_at > newest) newest = e.created_at;
    });

    return subscribeRelays(
      relays,
      { authors: [pubkey], since: newest || Math.floor(Date.now() / 1000) },
      {
        onEvent: (event) => {
          if (!eventMapRef.current.has(event.id)) processNewEvents([event]);
        },
      }
    );
  }, [pubkey, relays, isLoading, processNewEvents]);

  /** Re-run the initial fetch after a failure. */
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Load More (Infinite Scroll). Pages the category's own query when it has one,
  // otherwise the unfiltered one.
  const loadOlderEvents = useCallback(
    async (category = 'all') => {
      const key = cursorsRef.current.has(category) ? category : 'all';
      const cursor = cursorsRef.current.get(key);
      if (isLoadingMore || exhausted.has(key) || cursor === undefined || !pubkey || relays.length === 0) {
        return;
      }

      setIsLoadingMore(true);

      const filter = { authors: [pubkey], until: cursor - 1, limit: PAGE_LIMIT };
      if (key !== 'all') filter.kinds = CATEGORY_KINDS_MAP[key];

      const { events: newItems, ok, relays: relayStats } = await queryRelays(relays, filter, { subPrefix: 'more' });

      if (newItems.length > 0) {
        processNewEvents(newItems, key, nextPageCursor(relayStats, PAGE_LIMIT));
        setError(null);
      } else if (!ok) {
        setError('Could not load older events from the Nostr relays.');
      } else {
        // Only a relay-confirmed empty page means we reached the end.
        setExhausted((prev) => new Set(prev).add(key));
      }

      setIsLoadingMore(false);
    },
    [isLoadingMore, exhausted, pubkey, relays, processNewEvents]
  );

  // Fetch Category Specifically
  const fetchCategoryEvents = useCallback(
    async (category) => {
      const kinds = CATEGORY_KINDS_MAP[category];
      if (!kinds || kinds.length === 0 || !pubkey || relays.length === 0) return;

      const filter = {
        authors: [pubkey],
        kinds,
        limit: INITIAL_LIMIT,
      };

      const { events: incoming, relays: relayStats } = await queryRelays(relays, filter, { subPrefix: 'cat' });
      if (incoming.length > 0) {
        processNewEvents(incoming, category, nextPageCursor(relayStats, INITIAL_LIMIT));
      }
    },
    [pubkey, relays, processNewEvents]
  );

  /** Fetch a single event by id (e.g. a directly opened post) into eventMap. */
  const fetchEvent = useCallback((id) => fetchParents([id]), [fetchParents]);

  /** Whether the paging query used for `category` can still return older events. */
  const hasMoreFor = useCallback(
    (category = 'all') => !exhausted.has(cursorsRef.current.has(category) ? category : 'all'),
    [exhausted]
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
    error,
    retry,
    hasMoreFor,
    categoryCounts,
    loadOlderEvents,
    fetchCategoryEvents,
    fetchEvent,
  };
}

export default useNostrFeed;
