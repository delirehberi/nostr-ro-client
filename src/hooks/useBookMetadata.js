import { useState, useEffect } from 'react';
import { loadCache, saveCache, isFresh, foundEntry, notFoundEntry } from './metadataCache.js';

const STORAGE_KEY = 'nostr_book_metadata_cache';
const BATCH_SIZE = 30;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

const memoryCache = loadCache(STORAGE_KEY);
const pendingIsbns = new Set();
const attempts = new Map(); // isbn -> failed attempts so far
const listeners = new Map(); // isbn -> Set of callbacks
let batchTimer = null;

function notify(isbn, entry) {
  const cbs = listeners.get(isbn);
  if (!cbs) return;
  listeners.delete(isbn);
  cbs.forEach((cb) => cb(entry));
}

function scheduleBatch(delay) {
  // Never reset a pending timer: a steady stream of new cards would starve the queue.
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    batchTimer = null;
    fetchBatch();
  }, delay);
}

async function fetchBatch() {
  if (pendingIsbns.size === 0) return;
  const isbnsToFetch = Array.from(pendingIsbns).slice(0, BATCH_SIZE);
  isbnsToFetch.forEach((isbn) => pendingIsbns.delete(isbn));

  const bibkeys = isbnsToFetch.map((isbn) => `ISBN:${isbn}`).join(',');
  const url = `https://openlibrary.org/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`;

  let data = null;
  try {
    const res = await fetch(url);
    if (res.ok) data = await res.json();
  } catch (_) {}

  if (data) {
    isbnsToFetch.forEach((isbn) => {
      attempts.delete(isbn);
      const bookData = data[`ISBN:${isbn}`];
      let entry;
      if (bookData && bookData.title) {
        const author = bookData.authors && bookData.authors[0] ? bookData.authors[0].name : null;
        entry = foundEntry({
          title: bookData.title,
          author,
          cover: bookData.cover ? bookData.cover.medium || bookData.cover.small : null,
        });
      } else {
        entry = notFoundEntry();
      }
      memoryCache.set(isbn, entry);
      notify(isbn, entry);
    });
    saveCache(STORAGE_KEY, memoryCache);
  } else {
    // Network/API failure: retry with backoff, then give up without caching a miss.
    let nextDelay = null;
    isbnsToFetch.forEach((isbn) => {
      const failed = (attempts.get(isbn) || 0) + 1;
      if (failed < MAX_ATTEMPTS && listeners.has(isbn)) {
        attempts.set(isbn, failed);
        pendingIsbns.add(isbn);
        nextDelay = Math.max(nextDelay ?? 0, BASE_RETRY_DELAY_MS * 2 ** (failed - 1));
      } else {
        attempts.delete(isbn);
        listeners.delete(isbn);
      }
    });
    if (nextDelay !== null) scheduleBatch(nextDelay);
    return;
  }

  // If there are still pending isbns, schedule next batch
  if (pendingIsbns.size > 0) scheduleBatch(300);
}

/** Queue an ISBN lookup. Returns an unsubscribe function. */
function queueIsbn(isbn, callback) {
  if (!isbn) return () => {};
  const cached = memoryCache.get(isbn);
  if (isFresh(cached)) {
    callback(cached);
    return () => {};
  }

  if (!listeners.has(isbn)) {
    listeners.set(isbn, new Set());
  }
  listeners.get(isbn).add(callback);

  pendingIsbns.add(isbn);
  scheduleBatch(150);

  return () => {
    const cbs = listeners.get(isbn);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      listeners.delete(isbn);
      pendingIsbns.delete(isbn);
    }
  };
}

function freshCached(isbn) {
  const cached = isbn ? memoryCache.get(isbn) : null;
  return isFresh(cached) && !cached.notFound ? cached : null;
}

export function useBookMetadata(isbn, initialTitle = null) {
  const [data, setData] = useState(() => {
    if (initialTitle && initialTitle.toLowerCase() !== 'book') {
      return { title: initialTitle, isLoaded: true };
    }
    const cached = freshCached(isbn);
    if (cached) {
      return { ...cached, isLoaded: true };
    }
    return { title: initialTitle || (isbn ? `ISBN: ${isbn}` : 'Book'), isLoaded: false };
  });

  useEffect(() => {
    if (!isbn) return;

    if (initialTitle && initialTitle.toLowerCase() !== 'book') {
      setData({ title: initialTitle, isLoaded: true });
      return;
    }

    return queueIsbn(isbn, (resolved) => {
      if (resolved && resolved.title) {
        setData({ ...resolved, isLoaded: true });
      }
    });
  }, [isbn, initialTitle]);

  return data;
}

export default useBookMetadata;
