import { useState, useEffect } from 'react';
import { loadCache, saveCache, isFresh, foundEntry, notFoundEntry } from './metadataCache.js';

const STORAGE_KEY = 'nostr_movie_metadata_cache';
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

const memoryCache = loadCache(STORAGE_KEY);
const pendingImdbIds = new Set();
const attempts = new Map(); // imdbId -> failed attempts so far
const listeners = new Map(); // imdbId -> Set of callbacks
let batchTimer = null;

function notify(id, entry) {
  const cbs = listeners.get(id);
  if (!cbs) return;
  listeners.delete(id);
  cbs.forEach((cb) => cb(entry));
}

function scheduleQueue(delay) {
  // Never reset a pending timer: a steady stream of new cards would starve the queue.
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    batchTimer = null;
    processQueue();
  }, delay);
}

/** Look one title up on Cinemeta. Resolves to a cache entry, or null on a network/API failure. */
async function fetchMovieMeta(cleanId) {
  const defaultPoster = `https://images.metahub.space/poster/medium/${cleanId}/img.jpg`;

  try {
    let data = null;
    for (const type of ['movie', 'series']) {
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`);
      if (res.ok) {
        data = await res.json();
      } else if (res.status !== 404) {
        return null; // server error: retry later instead of caching a miss
      }
      if (data && data.meta) break;
    }

    if (data && data.meta) {
      const m = data.meta;
      return foundEntry({
        title: m.name || null,
        poster: m.poster || defaultPoster,
        year: m.year || null,
        director: m.director && m.director[0] ? m.director[0] : null,
        rating: m.imdbRating ? parseFloat(m.imdbRating) / 2 : null, // 10 scale to 5 scale
      });
    }
    // Unknown to Cinemeta: fall back to the CDN poster, remembered as a (short-lived) miss.
    return { ...notFoundEntry(), poster: defaultPoster };
  } catch (_) {
    return null;
  }
}

async function processQueue() {
  if (pendingImdbIds.size === 0) return;
  const ids = Array.from(pendingImdbIds).slice(0, BATCH_SIZE);
  ids.forEach((id) => pendingImdbIds.delete(id));

  let nextDelay = null;
  await Promise.all(
    ids.map(async (id) => {
      const entry = await fetchMovieMeta(id);
      if (entry) {
        attempts.delete(id);
        memoryCache.set(id, entry);
        notify(id, entry);
        return;
      }
      const failed = (attempts.get(id) || 0) + 1;
      if (failed < MAX_ATTEMPTS && listeners.has(id)) {
        attempts.set(id, failed);
        pendingImdbIds.add(id);
        nextDelay = Math.max(nextDelay ?? 0, BASE_RETRY_DELAY_MS * 2 ** (failed - 1));
      } else {
        attempts.delete(id);
        listeners.delete(id);
      }
    })
  );
  saveCache(STORAGE_KEY, memoryCache);

  if (nextDelay !== null) scheduleQueue(nextDelay);
  else if (pendingImdbIds.size > 0) scheduleQueue(200);
}

/** Queue a lookup. Returns an unsubscribe function. */
function queueImdb(imdbId, callback) {
  if (!imdbId) return () => {};
  const cleanId = imdbId.replace(/^imdb:/i, '').trim();

  const cached = memoryCache.get(cleanId);
  if (isFresh(cached)) {
    callback(cached);
    return () => {};
  }

  if (!listeners.has(cleanId)) {
    listeners.set(cleanId, new Set());
  }
  listeners.get(cleanId).add(callback);

  pendingImdbIds.add(cleanId);
  scheduleQueue(100);

  return () => {
    const cbs = listeners.get(cleanId);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      listeners.delete(cleanId);
      pendingImdbIds.delete(cleanId);
    }
  };
}

export function useMovieMetadata(imdbId, initialTitle = null, initialPoster = null) {
  const cleanId = imdbId ? imdbId.replace(/^imdb:/i, '').trim() : null;
  const isImdb = cleanId && /^tt\d+/i.test(cleanId);

  const [data, setData] = useState(() => {
    if (initialPoster) {
      return { poster: initialPoster, title: initialTitle, isLoaded: true };
    }
    if (isImdb && isFresh(memoryCache.get(cleanId))) {
      return { ...memoryCache.get(cleanId), isLoaded: true };
    }
    return {
      title: initialTitle || (isImdb ? `IMDb: ${cleanId}` : 'Movie'),
      poster: isImdb ? `https://images.metahub.space/poster/medium/${cleanId}/img.jpg` : initialPoster,
      isLoaded: false,
    };
  });

  useEffect(() => {
    if (!isImdb) {
      if (initialPoster || initialTitle) {
        setData({ poster: initialPoster, title: initialTitle, isLoaded: true });
      }
      return;
    }

    return queueImdb(cleanId, (resolved) => {
      if (resolved) {
        setData({ ...resolved, isLoaded: true });
      }
    });
  }, [cleanId, isImdb, initialPoster, initialTitle]);

  return data;
}

export default useMovieMetadata;
