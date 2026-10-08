import { OWNER_PUBKEY } from '../config.js';
import { IMAGE_EXT_REGEX, URL_REGEX, VIDEO_EXT_REGEX } from './patterns.js';
import { extractRating, getAllTagValues, getTagValue } from './tags.js';

// Events are immutable, so classification is computed once per event object.
// The result is shared between callers and must be treated as read-only.
const classifyCache = new WeakMap();

/**
 * Classify a Nostr event into main category and sub-category
 * @param {object} event
 * @returns {{ category: string, subCategory: string }}
 */
export function classifyEvent(event) {
  if (!event || typeof event !== 'object') return computeClassification(event);
  let result = classifyCache.get(event);
  if (!result) {
    result = computeClassification(event);
    classifyCache.set(event, result);
  }
  return result;
}

function computeClassification(event) {
  if (!event || typeof event.kind !== 'number') {
    return { category: 'other', subCategory: 'generic' };
  }

  const kind = event.kind;
  const tags = event.tags || [];
  const content = event.content || '';
  const dTag = (getTagValue(tags, 'd') || '').toLowerCase();
  const titleTag = (getTagValue(tags, 'title') || '').toLowerCase();
  const topicTags = getAllTagValues(tags, 't').map((t) => t.toLowerCase());

  // 1. Articles / Long-form Content (Kind 30023, Kind 30024)
  if (kind === 30023 || kind === 30024) {
    const isOwner = event.pubkey === OWNER_PUBKEY;
    return { category: 'articles', subCategory: isOwner ? 'my' : 'liked' };
  }

  // 2. Highlights (Kind 9802)
  if (kind === 9802) {
    return { category: 'highlights', subCategory: 'quote' };
  }

  // 3. Bookstr.xyz & Books Ecosystem
  // - Kind 30040 (Bookstr Curated Publication Index)
  // - Kind 30041 (Bookstr Curated Publication Content)
  // - Kind 30001/30003 lists with books-* d-tags or book topic
  // - Kind 1985 / 31985 (NIP-32 labels/reviews) tagged with book/reading/isbn
  const isBookKind = kind === 30040 || kind === 30041;
  const hasIsbnTag = tags.some((t) => Array.isArray(t) && (t[0] === 'isbn' || (t[0] === 'i' && (t[1] || '').toLowerCase().startsWith('isbn:'))));
  const isBookTag =
    dTag.includes('book') ||
    dTag.includes('reading') ||
    titleTag.includes('book') ||
    titleTag.includes('reading') ||
    topicTags.some((t) => t === 'book' || t === 'books' || t === 'reading' || t === 'bookstr' || t === 'novel' || t === 'literature') ||
    tags.some((t) => Array.isArray(t) && (t[0] === 'isbn' || t[0] === 'book')) ||
    hasIsbnTag ||
    content.toLowerCase().includes('goodreads');

  if (isBookKind || ((kind === 30001 || kind === 30003 || kind === 1985 || kind === 31985 || kind === 30004) && isBookTag) || (hasIsbnTag && (kind === 1985 || kind === 31985 || extractRating(tags, content) !== null))) {
    let sub = 'reading';
    if (kind === 1985 || kind === 31985 || extractRating(tags, content) !== null || dTag.includes('rated') || dTag.includes('review')) {
      sub = 'rated';
    } else if (dTag.includes('to-read') || dTag.includes('want-to-read') || dTag.includes('wishlist')) {
      sub = 'to-read';
    } else if (dTag.includes('reading') || dTag.includes('currently-reading')) {
      sub = 'reading';
    } else if (dTag === 'read' || dTag.startsWith('books-read') || dTag.includes('already-read') || dTag.includes('finished')) {
      sub = 'read';
    } else if (isBookKind) {
      sub = 'reading';
    }
    return { category: 'books', subCategory: sub };
  }

  // 4. Movies & Cinema Ecosystem
  // - Kind 30001/30003 with movie-* d-tags
  // - Kind 1985 / 31985 reviews tagged with movie/cinema/film/imdb/tmdb/letterboxd
  // - Kind 31989/31922/31923 media trackers
  const hasImdbTag = tags.some((t) => Array.isArray(t) && (t[0] === 'imdb' || (t[0] === 'i' && (t[1] || '').toLowerCase().startsWith('imdb:'))));
  const hasTmdbTag = tags.some((t) => Array.isArray(t) && (t[0] === 'tmdb' || (t[0] === 'i' && (t[1] || '').toLowerCase().startsWith('tmdb:'))));
  const hasMovieUrlTag = tags.some((t) => Array.isArray(t) && t[0] === 'r' && (t[1] || '').match(/(?:imdb\.com|themoviedb\.org|boxd\.it|letterboxd\.com)/i));

  const isMovieTag =
    dTag.includes('movie') ||
    dTag.includes('film') ||
    dTag.includes('cinema') ||
    dTag.includes('watchlist') ||
    dTag.includes('letterboxd') ||
    titleTag.includes('movie') ||
    titleTag.includes('film') ||
    titleTag.includes('cinema') ||
    topicTags.some((t) => t === 'movie' || t === 'movies' || t === 'film' || t === 'cinema' || t === 'watchlist' || t === 'letterboxd') ||
    tags.some((t) => Array.isArray(t) && (t[0] === 'imdb' || t[0] === 'tmdb' || t[0] === 'movie')) ||
    hasImdbTag ||
    hasTmdbTag ||
    hasMovieUrlTag ||
    content.toLowerCase().includes('letterboxd') ||
    content.toLowerCase().includes('imdb.com');

  if ((kind === 30001 || kind === 30003 || kind === 1985 || kind === 31985 || kind === 31922 || kind === 31923 || kind === 30004) && isMovieTag) {
    let sub = 'watched';
    if (kind === 1985 || kind === 31985 || extractRating(tags, content) !== null || dTag.includes('rated') || dTag.includes('reviews')) {
      sub = 'rated';
    } else if (dTag.includes('watchlist') || dTag.includes('to-watch') || dTag.includes('want-to-watch')) {
      sub = 'watchlist';
    } else {
      sub = 'watched';
    }
    return { category: 'movies', subCategory: sub };
  }

  // 5. Media (Kind 20 picture, Kind 21/22 video, Kind 1063 file metadata, or Kind 1 media posts)
  if (kind === 20) {
    return { category: 'media', subCategory: 'photos' };
  }
  if (kind === 21 || kind === 22) {
    return { category: 'media', subCategory: 'videos' };
  }
  if (kind === 1063) {
    const mime = (getTagValue(tags, 'm') || '').toLowerCase();
    if (mime.startsWith('image/')) return { category: 'media', subCategory: 'photos' };
    if (mime.startsWith('video/')) return { category: 'media', subCategory: 'videos' };
    return { category: 'media', subCategory: 'all' };
  }

  // 6. Generic Lists & Sets (Kind 3 Contact list, 10000-19999 and 30000-30005)
  if (kind === 3 || (kind >= 10000 && kind < 20000) || (kind >= 30000 && kind <= 30005)) {
    if (kind === 3 || kind === 30000 || kind === 10000 || kind === 10017) {
      return { category: 'lists', subCategory: 'people' };
    }
    if (kind === 10003 || kind === 30001 || kind === 30003) {
      return { category: 'lists', subCategory: 'bookmarks' };
    }
    if (kind === 30004 || kind === 30005 || kind === 10002 || kind === 30002) {
      return { category: 'lists', subCategory: 'curations' };
    }
    return { category: 'lists', subCategory: 'all' };
  }

  // 7. Notes & Microblogging
  // - Kind 6, 16: Reposts
  // - Kind 1111: Comments
  // - Kind 1: Short text notes (check if it's reply or root post, or media post)
  if (kind === 6 || kind === 16) {
    return { category: 'notes', subCategory: 'reposts' };
  }
  if (kind === 1111) {
    return { category: 'notes', subCategory: 'replies' };
  }
  if (kind === 1) {
    // Check if reply
    const hasParentReply = tags.some((t) => Array.isArray(t) && t[0] === 'e' && t[1] && t[1] !== event.id);
    if (hasParentReply) {
      return { category: 'notes', subCategory: 'replies' };
    }

    // Check if standalone media note (contains image/video url and minimal text)
    const urls = content.match(URL_REGEX) || [];
    const hasImage = urls.some((u) => IMAGE_EXT_REGEX.test(u));
    const hasVideo = urls.some((u) => VIDEO_EXT_REGEX.test(u));

    if (hasImage && !hasVideo && content.replace(URL_REGEX, '').trim().length < 40) {
      return { category: 'media', subCategory: 'photos' };
    }
    if (hasVideo && content.replace(URL_REGEX, '').trim().length < 40) {
      return { category: 'media', subCategory: 'videos' };
    }

    return { category: 'notes', subCategory: 'posts' };
  }

  // 8. Code Snippets (Kind 1337 / Kind 31337 / NIP-CO)
  if (kind === 1337 || kind === 31337) {
    return { category: 'other', subCategory: 'snippet' };
  }

  // 9. NIP-34 Git events
  if (kind === 1617 || kind === 1618 || kind === 1621 || kind === 1622 || (kind >= 1630 && kind <= 1633) || kind === 30617 || kind === 30618) {
    return { category: 'other', subCategory: 'git' };
  }

  // 10. NIP-89 App Handlers & Recommendations
  if (kind === 31990 || kind === 31989) {
    return { category: 'other', subCategory: 'app' };
  }

  // 11. Reactions
  if (kind === 7) {
    return { category: 'other', subCategory: 'reaction' };
  }

  // Fallback
  return { category: 'other', subCategory: `kind-${kind}` };
}
