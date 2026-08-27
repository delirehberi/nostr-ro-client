import { useState, useEffect } from 'react';

const memoryCache = new Map();
const pendingImdbIds = new Set();
const listeners = new Map(); // imdbId -> Set of callbacks
let batchTimer = null;

// Initialize memory cache from localStorage if available
try {
  const saved = localStorage.getItem('nostr_movie_metadata_cache');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([id, data]) => {
      memoryCache.set(id, data);
    });
  }
} catch (_) {}

function saveToLocalStorage() {
  try {
    const obj = {};
    memoryCache.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem('nostr_movie_metadata_cache', JSON.stringify(obj));
  } catch (_) {}
}

async function fetchMovieMeta(imdbId) {
  if (!imdbId) return;
  const cleanId = imdbId.replace(/^imdb:/i, '').trim();
  if (!/^tt\d+/i.test(cleanId)) return;

  const defaultPoster = `https://images.metahub.space/poster/medium/${cleanId}/img.jpg`;

  try {
    // Try movie endpoint first
    let res = await fetch(`https://v3-cinemeta.strem.io/meta/movie/${cleanId}.json`);
    let data = res.ok ? await res.json() : null;

    // Fallback to series if movie not found
    if (!data || !data.meta) {
      res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${cleanId}.json`);
      data = res.ok ? await res.json() : null;
    }

    if (data && data.meta) {
      const m = data.meta;
      const result = {
        title: m.name || null,
        poster: m.poster || defaultPoster,
        year: m.year || null,
        director: m.director && m.director[0] ? m.director[0] : null,
        rating: m.imdbRating ? parseFloat(m.imdbRating) / 2 : null, // 10 scale to 5 scale
      };
      memoryCache.set(cleanId, result);

      const cbs = listeners.get(cleanId);
      if (cbs) {
        cbs.forEach((cb) => cb(result));
        listeners.delete(cleanId);
      }
      saveToLocalStorage();
      return;
    }
  } catch (_) {}

  // Fallback with CDN poster
  const fallback = {
    poster: defaultPoster,
  };
  memoryCache.set(cleanId, fallback);
  const cbs = listeners.get(cleanId);
  if (cbs) {
    cbs.forEach((cb) => cb(fallback));
    listeners.delete(cleanId);
  }
}

async function processQueue() {
  if (pendingImdbIds.size === 0) return;
  const ids = Array.from(pendingImdbIds).slice(0, 10);
  ids.forEach((id) => pendingImdbIds.delete(id));

  await Promise.all(ids.map((id) => fetchMovieMeta(id)));

  if (pendingImdbIds.size > 0) {
    setTimeout(processQueue, 200);
  }
}

function queueImdb(imdbId, callback) {
  if (!imdbId) return;
  const cleanId = imdbId.replace(/^imdb:/i, '').trim();

  if (memoryCache.has(cleanId)) {
    callback(memoryCache.get(cleanId));
    return;
  }

  if (!listeners.has(cleanId)) {
    listeners.set(cleanId, new Set());
  }
  listeners.get(cleanId).add(callback);

  pendingImdbIds.add(cleanId);
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(processQueue, 100);
}

export function useMovieMetadata(imdbId, initialTitle = null, initialPoster = null) {
  const cleanId = imdbId ? imdbId.replace(/^imdb:/i, '').trim() : null;
  const isImdb = cleanId && /^tt\d+/i.test(cleanId);

  const [data, setData] = useState(() => {
    if (initialPoster) {
      return { poster: initialPoster, title: initialTitle, isLoaded: true };
    }
    if (isImdb && memoryCache.has(cleanId)) {
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

    if (memoryCache.has(cleanId)) {
      setData({ ...memoryCache.get(cleanId), isLoaded: true });
      return;
    }

    queueImdb(cleanId, (resolved) => {
      if (resolved) {
        setData({ ...resolved, isLoaded: true });
      }
    });
  }, [cleanId, isImdb, initialPoster, initialTitle]);

  return data;
}

export default useMovieMetadata;
