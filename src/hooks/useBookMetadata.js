import { useState, useEffect } from 'react';

const memoryCache = new Map();
const pendingIsbns = new Set();
const listeners = new Map(); // isbn -> Set of callbacks
let batchTimer = null;

// Initialize memory cache from localStorage if available
try {
  const saved = localStorage.getItem('nostr_book_metadata_cache');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([isbn, data]) => {
      memoryCache.set(isbn, data);
    });
  }
} catch (_) {}

function saveToLocalStorage() {
  try {
    const obj = {};
    memoryCache.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem('nostr_book_metadata_cache', JSON.stringify(obj));
  } catch (_) {}
}

async function fetchBatch() {
  if (pendingIsbns.size === 0) return;
  const isbnsToFetch = Array.from(pendingIsbns).slice(0, 30);
  isbnsToFetch.forEach((isbn) => pendingIsbns.delete(isbn));

  const bibkeys = isbnsToFetch.map((isbn) => `ISBN:${isbn}`).join(',');
  const url = `https://openlibrary.org/api/books?bibkeys=${bibkeys}&format=json&jscmd=data`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      isbnsToFetch.forEach((isbn) => {
        const bookData = data[`ISBN:${isbn}`];
        if (bookData && bookData.title) {
          const author = bookData.authors && bookData.authors[0] ? bookData.authors[0].name : null;
          const result = {
            title: bookData.title,
            author,
            cover: bookData.cover ? bookData.cover.medium || bookData.cover.small : null,
          };
          memoryCache.set(isbn, result);

          const cbs = listeners.get(isbn);
          if (cbs) {
            cbs.forEach((cb) => cb(result));
            listeners.delete(isbn);
          }
        }
      });
      saveToLocalStorage();
    }
  } catch (_) {}

  // If there are still pending isbns, schedule next batch
  if (pendingIsbns.size > 0) {
    setTimeout(fetchBatch, 300);
  }
}

function queueIsbn(isbn, callback) {
  if (!isbn) return;
  if (memoryCache.has(isbn)) {
    callback(memoryCache.get(isbn));
    return;
  }

  if (!listeners.has(isbn)) {
    listeners.set(isbn, new Set());
  }
  listeners.get(isbn).add(callback);

  pendingIsbns.add(isbn);
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(fetchBatch, 150);
}

export function useBookMetadata(isbn, initialTitle = null) {
  const [data, setData] = useState(() => {
    if (initialTitle && initialTitle.toLowerCase() !== 'book') {
      return { title: initialTitle, isLoaded: true };
    }
    if (isbn && memoryCache.has(isbn)) {
      return { ...memoryCache.get(isbn), isLoaded: true };
    }
    return { title: initialTitle || (isbn ? `ISBN: ${isbn}` : 'Book'), isLoaded: false };
  });

  useEffect(() => {
    if (!isbn) return;

    if (initialTitle && initialTitle.toLowerCase() !== 'book') {
      setData({ title: initialTitle, isLoaded: true });
      return;
    }

    if (memoryCache.has(isbn)) {
      setData({ ...memoryCache.get(isbn), isLoaded: true });
      return;
    }

    queueIsbn(isbn, (resolved) => {
      if (resolved && resolved.title) {
        setData({ ...resolved, isLoaded: true });
      }
    });
  }, [isbn, initialTitle]);

  return data;
}

export default useBookMetadata;
