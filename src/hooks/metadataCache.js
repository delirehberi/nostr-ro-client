/**
 * Small persisted cache shared by the metadata hooks (books, movies).
 *
 * Entries are `{...data, ts, notFound?}`. Found entries live for a month, misses
 * for a day (so unknown ids are not re-requested on every page load), and the
 * persisted copy is capped so localStorage cannot grow without bound.
 */

export const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PERSISTED_ENTRIES = 500;

export function isFresh(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return false;
  const ttl = entry.notFound ? NOT_FOUND_TTL_MS : FOUND_TTL_MS;
  return now - (entry.ts ?? now) < ttl;
}

/** Cache entry for a successful lookup. */
export function foundEntry(data, now = Date.now()) {
  return { ...data, ts: now };
}

/** Cache entry for an id the upstream API does not know. */
export function notFoundEntry(now = Date.now()) {
  return { notFound: true, ts: now };
}

/** Read the persisted cache, dropping expired or malformed entries. */
export function loadCache(storageKey) {
  const map = new Map();
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return map;
    const now = Date.now();
    Object.entries(JSON.parse(saved)).forEach(([id, entry]) => {
      if (isFresh(entry, now)) map.set(id, entry);
    });
  } catch (_) {}
  return map;
}

/** Persist the newest MAX_PERSISTED_ENTRIES entries. */
export function saveCache(storageKey, map) {
  try {
    const newest = Array.from(map.entries())
      .sort((a, b) => (b[1].ts ?? 0) - (a[1].ts ?? 0))
      .slice(0, MAX_PERSISTED_ENTRIES);
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(newest)));
  } catch (_) {}
}
