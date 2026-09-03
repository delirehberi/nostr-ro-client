import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { nip19 } from 'nostr-tools';
import { FilterBar } from './components/FilterBar.jsx';
import { CommunityBadge } from './components/CommunityBadge.jsx';
import { EventCard } from './components/EventCard.jsx';
import { classifyEvent } from './kinds.js';
import { useProfiles } from './hooks/useProfiles.js';
import { useTheme } from './hooks/useTheme.js';
import { useNostrFeed } from './hooks/useNostrFeed.js';

const DEFAULT_PUBKEY = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.ditto.pub',
  'wss://nostr-pub.wellorder.net',
];

export function App() {
  const [activeCategory, setActiveCategory] = useState('notes');
  const [activeSub, setActiveSub] = useState('all');
  const [singlePostId, setSinglePostId] = useState(null);

  const sentinelRef = useRef(null);
  const fetchedCategoriesRef = useRef(new Set(['notes']));

  const { profileMap, requestProfiles } = useProfiles(DEFAULT_RELAYS);
  useTheme(DEFAULT_PUBKEY, DEFAULT_RELAYS);

  const {
    events,
    eventMap,
    isLoading,
    isLoadingMore,
    hasMore,
    categoryCounts,
    loadOlderEvents,
    fetchCategoryEvents,
  } = useNostrFeed(DEFAULT_PUBKEY, DEFAULT_RELAYS, requestProfiles);

  // Parse Initial URL (Path & Query)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (path.startsWith('/p/')) {
        const rawId = path.slice(3);
        let hexId = rawId;
        if (rawId.startsWith('note1') || rawId.startsWith('nevent1')) {
          try {
            const decoded = nip19.decode(rawId);
            if (decoded.type === 'note') hexId = decoded.data;
            else if (decoded.type === 'nevent') hexId = decoded.data.id;
          } catch (_) {}
        }
        setSinglePostId(hexId);
      } else {
        setSinglePostId(null);
        const params = new URLSearchParams(window.location.search);
        setActiveCategory(params.get('kind') || 'notes');
        setActiveSub(params.get('sub') || 'all');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Category Selection Handler
  const handleSelectCategory = useCallback(
    (cat, sub) => {
      setActiveCategory(cat);
      setActiveSub(sub);

      const params = new URLSearchParams(window.location.search);
      if (cat === 'notes') params.delete('kind');
      else params.set('kind', cat);

      if (sub === 'all') params.delete('sub');
      else params.set('sub', sub);

      const query = params.toString();
      const newUrl = '/' + (query ? '?' + query : '');
      window.history.pushState({ category: cat, sub }, '', newUrl);

      if (cat !== 'all' && !fetchedCategoriesRef.current.has(cat)) {
        fetchedCategoriesRef.current.add(cat);
        fetchCategoryEvents(cat);
      }
    },
    [fetchCategoryEvents]
  );

  // Infinite Scroll Observer
  useEffect(() => {
    if (singlePostId || isLoading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadOlderEvents();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [singlePostId, isLoading, isLoadingMore, hasMore, loadOlderEvents]);

  // Filtered Events List
  const visibleEvents = useMemo(() => {
    if (singlePostId) {
      const found = eventMap.get(singlePostId);
      return found ? [found] : [];
    }

    return events.filter((evt) => {
      const { category, subCategory } = classifyEvent(evt);
      const matchCat = activeCategory === 'all' || category === activeCategory;
      const matchSub = activeSub === 'all' || subCategory === activeSub;
      return matchCat && matchSub;
    });
  }, [events, eventMap, singlePostId, activeCategory, activeSub]);

  return (
    <div className="container">
      <emre-header active-page="nostr"></emre-header>
      <CommunityBadge />

      {singlePostId ? (
        <>
          <div className="back-link-bar">
            <a
              href="/"
              className="back-link"
              onClick={(e) => {
                e.preventDefault();
                setSinglePostId(null);
                window.history.pushState({}, '', '/');
              }}
            >
              ← Back to all posts
            </a>
          </div>
          <main id="events-feed">
            {visibleEvents.length > 0 ? (
              <EventCard
                key={singlePostId}
                event={visibleEvents[0]}
                profileMap={profileMap}
                eventMap={eventMap}
              />
            ) : (
              <div className="no-posts">
                {isLoading ? 'Loading post...' : 'Event not found on Nostr relays.'}
              </div>
            )}
          </main>
        </>
      ) : (
        <>
          <FilterBar
            categoryCounts={categoryCounts}
            activeCategory={activeCategory}
            activeSub={activeSub}
            onSelectCategory={handleSelectCategory}
          />

          <main id="events-feed">
            {visibleEvents.length > 0 ? (
              visibleEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  profileMap={profileMap}
                  eventMap={eventMap}
                />
              ))
            ) : (
              <div className="no-posts">
                {isLoading
                  ? 'Connecting to Nostr relays...'
                  : 'No events found in this category.'}
              </div>
            )}
          </main>

          <div ref={sentinelRef} className="loading-sentinel">
            {isLoadingMore && 'Loading older events from Nostr relays...'}
            {!hasMore && events.length > 0 && 'All events loaded.'}
          </div>
        </>
      )}

      <emre-footer></emre-footer>
    </div>
  );
}

export default App;
