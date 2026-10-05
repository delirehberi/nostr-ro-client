import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FilterBar } from './components/FilterBar.jsx';
import { CommunityBadge } from './components/CommunityBadge.jsx';
import { EventCard } from './components/EventCard.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { classifyEvent } from './kinds.js';
import { useProfiles } from './hooks/useProfiles.js';
import { useTheme } from './hooks/useTheme.js';
import { useNostrFeed } from './hooks/useNostrFeed.js';
import { getDefaultRelays } from './relays.js';
import { parseLocation, buildFeedUrl } from './urlState.js';

const DEFAULT_PUBKEY = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';
const DEFAULT_RELAYS = getDefaultRelays();

export function App() {
  const [activeCategory, setActiveCategory] = useState('notes');
  const [activeSub, setActiveSub] = useState('all');
  const [singlePostId, setSinglePostId] = useState(null);
  const [invalidPostUrl, setInvalidPostUrl] = useState(false);

  const sentinelRef = useRef(null);
  const fetchedCategoriesRef = useRef(new Set(['notes']));

  const { profileMap, requestProfiles } = useProfiles(DEFAULT_RELAYS);
  useTheme(DEFAULT_PUBKEY, DEFAULT_RELAYS);

  const {
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
  } = useNostrFeed(DEFAULT_PUBKEY, DEFAULT_RELAYS, requestProfiles);
  const hasMore = hasMoreFor(activeCategory);

  // Sync state from the URL (initial load and back/forward navigation)
  useEffect(() => {
    const handleUrlChange = () => {
      const state = parseLocation(window.location);
      if (state.view === 'post') {
        // An undecodable id still opens the post view (showing an error) instead of the feed.
        setSinglePostId(state.postId ?? 'invalid');
        setInvalidPostUrl(state.postId === null);
      } else {
        setSinglePostId(null);
        setInvalidPostUrl(false);
        setActiveCategory(state.category);
        setActiveSub(state.sub);
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Fetch a category's events the first time it becomes active (whether via tab click or URL)
  useEffect(() => {
    if (activeCategory !== 'all' && !fetchedCategoriesRef.current.has(activeCategory)) {
      fetchedCategoriesRef.current.add(activeCategory);
      fetchCategoryEvents(activeCategory);
    }
  }, [activeCategory, fetchCategoryEvents]);

  // Fetch a directly opened post that is not part of the loaded feed
  useEffect(() => {
    if (singlePostId && !invalidPostUrl && !isLoading && !eventMap.has(singlePostId)) {
      fetchEvent(singlePostId);
    }
  }, [singlePostId, invalidPostUrl, isLoading, eventMap, fetchEvent]);

  // Category Selection Handler
  const handleSelectCategory = useCallback((cat, sub) => {
    setActiveCategory(cat);
    setActiveSub(sub);
    window.history.pushState({ category: cat, sub }, '', buildFeedUrl(cat, sub));
  }, []);

  // Infinite Scroll Observer
  useEffect(() => {
    if (singlePostId || isLoading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadOlderEvents(activeCategory);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [singlePostId, isLoading, isLoadingMore, hasMore, activeCategory, loadOlderEvents]);

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
              href={buildFeedUrl(activeCategory, activeSub)}
              className="back-link"
              onClick={(e) => {
                e.preventDefault();
                setSinglePostId(null);
                setInvalidPostUrl(false);
                window.history.pushState({}, '', buildFeedUrl(activeCategory, activeSub));
              }}
            >
              ← Back to all posts
            </a>
          </div>
          <main id="events-feed">
            {visibleEvents.length > 0 ? (
              <ErrorBoundary key={singlePostId}>
                <EventCard
                  event={visibleEvents[0]}
                  profileMap={profileMap}
                  eventMap={eventMap}
                />
              </ErrorBoundary>
            ) : (
              <div className="no-posts">
                {isLoading ? 'Loading post...' : invalidPostUrl ? 'Invalid post link.' : 'Event not found on Nostr relays.'}
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

          {error && (
            <div className="relay-error" role="alert">
              <span>{error}</span>{' '}
              <button
                type="button"
                className="relay-error-retry"
                onClick={() => (events.length === 0 ? retry() : loadOlderEvents(activeCategory))}
              >
                Retry
              </button>
            </div>
          )}

          <main id="events-feed">
            {visibleEvents.length > 0 ? (
              visibleEvents.map((evt) => (
                <ErrorBoundary key={evt.id}>
                  <EventCard
                    event={evt}
                    profileMap={profileMap}
                    eventMap={eventMap}
                  />
                </ErrorBoundary>
              ))
            ) : (
              <div className="no-posts">
                {isLoading
                  ? 'Connecting to Nostr relays...'
                  : error
                    ? 'Events could not be loaded.'
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
