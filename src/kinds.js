/**
 * Nostr Event Kinds & Category Classification Engine
 * Supports standard NIPs and specialized ecosystem conventions:
 * - Bookstr.xyz (Kinds 30040, 30041, Kind 30001 with books-* d-tags)
 * - Movies & Cinema (Kind 30001/30003 movies-* d-tags, Kind 1985 reviews, Kind 31922/31923)
 * - Articles (Kind 30023, 30024 with canonical linking to blog.emre.xyz)
 * - Media (Kind 20 photos, Kind 21/22 videos, Kind 1063 files, Kind 1 media)
 * - Lists (Kind 30000 people, 30001 sets, 30003 bookmarks, 30004 articles, 10003)
 * - Notes & Microblogging (Kind 1, Kind 1111 comments, Kind 6/16 reposts)
 * - Highlights (Kind 9802)
 */

export const CATEGORIES_CONFIG = [
  {
    id: 'all',
    label: 'All',
    icon: 'sparkles',
    subFilters: []
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: 'message-square',
    subFilters: [
      { id: 'all', label: 'All Notes' },
      { id: 'posts', label: 'Posts' },
      { id: 'replies', label: 'Replies' },
      { id: 'reposts', label: 'Reposts' }
    ]
  },
  {
    id: 'books',
    label: 'Books',
    icon: 'book-open',
    subFilters: [
      { id: 'all', label: 'All Books' },
      { id: 'reading', label: 'Reading' },
      { id: 'read', label: 'Read' },
      { id: 'to-read', label: 'To Read' },
      { id: 'rated', label: 'Reviews & Ratings' }
    ]
  },
  {
    id: 'movies',
    label: 'Movies',
    icon: 'film',
    subFilters: [
      { id: 'all', label: 'All Movies' },
      { id: 'watched', label: 'Watched' },
      { id: 'rated', label: 'Reviews & Ratings' },
      { id: 'watchlist', label: 'Watchlist' }
    ]
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'image',
    subFilters: [
      { id: 'all', label: 'All Media' },
      { id: 'photos', label: 'Photos' },
      { id: 'videos', label: 'Videos' }
    ]
  },
  {
    id: 'lists',
    label: 'Lists',
    icon: 'list',
    subFilters: [
      { id: 'all', label: 'All Lists' },
      { id: 'people', label: 'People' },
      { id: 'bookmarks', label: 'Bookmarks' },
      { id: 'curations', label: 'Curations' }
    ]
  },
  {
    id: 'articles',
    label: 'Articles',
    icon: 'file-text',
    subFilters: [
      { id: 'all', label: 'All Articles' },
      { id: 'my', label: 'My Articles' },
      { id: 'liked', label: 'Liked & Curated' }
    ]
  },
  {
    id: 'highlights',
    label: 'Highlights',
    icon: 'bookmark',
    subFilters: []
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'more-horizontal',
    subFilters: []
  }
];

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp|svg|avif)(?:\?[^#\s]*)?$/i;
const VIDEO_EXT_REGEX = /\.(mp4|webm|ogg|mov|m4v)(?:\?[^#\s]*)?$/i;
const URL_REGEX = /https?:\/\/[^\s<]+/g;

/**
 * Extract tag value helper
 * @param {Array<Array<string>>} tags
 * @param {string} tagName
 * @returns {string|null}
 */
export function getTagValue(tags, tagName) {
  if (!Array.isArray(tags)) return null;
  const match = tags.find((t) => Array.isArray(t) && t[0] === tagName && t[1]);
  return match ? match[1] : null;
}

/**
 * Extract all tag values helper
 * @param {Array<Array<string>>} tags
 * @param {string} tagName
 * @returns {Array<string>}
 */
export function getAllTagValues(tags, tagName) {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t) => Array.isArray(t) && t[0] === tagName && t[1])
    .map((t) => t[1]);
}

/**
 * Extract rating value (e.g. from NIP-32 label / review tags)
 * @param {Array<Array<string>>} tags
 * @param {string} content
 * @returns {number|null} 0.0 to 5.0 or 0 to 10
 */
export function extractRating(tags, content = '') {
  // 1. Check content first for explicit text like "Rated 5/5 stars" or "★★★★☆"
  if (content) {
    const scoreMatch = content.match(/(?:rated|rating|score|puan)(?::|\s+)\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      const max = parseFloat(scoreMatch[2]);
      if (max > 0) return (score / max) * 5;
    }
    const starMatches = content.match(/[★⭐]/g);
    if (starMatches && starMatches.length > 0 && starMatches.length <= 10) {
      return Math.min(5, starMatches.length);
    }
  }

  // 2. Check tags
  if (Array.isArray(tags)) {
    // Check for rating tag: ["rating", "5", "5"] or ["rating", "1.0"] or ["rating", "4.5"]
    const ratingTag = tags.find((t) => Array.isArray(t) && (t[0] === 'rating' || t[0] === 'rate' || t[0] === 'score'));
    if (ratingTag && ratingTag[1]) {
      const val = parseFloat(ratingTag[1]);
      if (!isNaN(val)) {
        if (ratingTag[2] && parseFloat(ratingTag[2]) > 0) {
          const max = parseFloat(ratingTag[2]);
          return (val / max) * 5;
        }
        // If 0 < val <= 1.0, it's normalized 0-1 scale (NIP-32) -> multiply by 5
        if (val > 0 && val <= 1.0) {
          return val * 5;
        }
        return val <= 5 ? val : (val / 10) * 5;
      }
    }

    // Check for NIP-32 label tag with rating e.g. ["l", "1.0", "rating"] or ["l", "4.5", "rating"] or ["L", "rating", "1.0"]
    const lTag = tags.find((t) => Array.isArray(t) && (t[0] === 'l' || t[0] === 'L') && t.some((part) => part.includes('rating') || part.includes('star')));
    if (lTag) {
      const numPart = lTag.find((part) => !isNaN(parseFloat(part)));
      if (numPart) {
        const val = parseFloat(numPart);
        if (val > 0 && val <= 1.0) {
          return val * 5;
        }
        return val <= 5 ? val : (val / 10) * 5;
      }
    }
  }

  return null;
}

export function getKindLabel(kind) {
  switch (kind) {
    case 0:
      return '👤 Profile Metadata';
    case 1:
      return '💬 Note';
    case 3:
      return '👥 Follow List';
    case 6:
    case 16:
      return '🔁 Repost';
    case 7:
      return '❤️ Reaction';
    case 20:
      return '🖼️ Photo';
    case 21:
    case 22:
      return '📹 Video';
    case 1063:
      return '📁 File Metadata';
    case 1111:
      return '💬 Comment';
    case 1985:
      return '⭐ Label / Review';
    case 9802:
      return '💡 Highlight';
    case 10000:
      return '🔇 Mute List';
    case 10001:
      return '📌 Pinned Notes';
    case 10002:
      return '📡 Relay List (NIP-65)';
    case 10003:
      return '🔖 Bookmarks';
    case 10004:
      return '🌐 Communities';
    case 10005:
      return '💬 Public Chats';
    case 10006:
      return '🚫 Blocked Relays';
    case 10007:
      return '🔍 Search Relays';
    case 10015:
      return '🎯 Interests List';
    case 10030:
      return '😀 Custom Emojis';
    case 10050:
      return '📬 DM Relays';
    case 10073:
      return '🎙️ Media Relays';
    case 10074:
      return '🌸 Blossom Servers';
    case 16767:
    case 36767:
      return '🎨 Theme Setting';
    case 30000:
      return '👥 People Set';
    case 30001:
      return '📋 Curated Set';
    case 30002:
      return '📡 Relay Set';
    case 30003:
      return '🔖 Bookmark Set';
    case 30004:
      return '✍️ Article Curation';
    case 30005:
      return '📹 Video Curation';
    case 30023:
    case 30024:
      return '✍️ Long-form Article';
    case 30040:
    case 30041:
      return '📚 Bookstr Publication';
    case 30617:
      return '💻 Git Repository (NIP-34)';
    case 30618:
      return '📦 Repository State (NIP-34)';
    case 31922:
    case 31923:
    case 31989:
      return '🎬 Media Tracker';
    case 31985:
      return '⭐ Review / Rating';
    default:
      if (kind >= 10000 && kind < 20000) return `📋 List (Kind ${kind})`;
      if (kind >= 30000 && kind < 40000) return `⚙️ App Data (Kind ${kind})`;
      return `Kind ${kind}`;
  }
}

export const OWNER_PUBKEY = '46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a';

/**
 * Classify a Nostr event into main category and sub-category
 * @param {object} event
 * @returns {{ category: string, subCategory: string }}
 */
export function classifyEvent(event) {
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

  if ((kind === 30001 || kind === 30003 || kind === 1985 || kind === 31985 || kind === 31989 || kind === 31922 || kind === 31923 || kind === 30004) && isMovieTag) {
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

  // 6. Generic Lists & Sets (All 10000-19999 and 30000-30005)
  if ((kind >= 10000 && kind < 20000) || (kind >= 30000 && kind <= 30005)) {
    if (kind === 30000 || kind === 10000) {
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

  // Fallback
  return { category: 'other', subCategory: `kind-${kind}` };
}

/**
 * Extract structured metadata from any Nostr event
 * @param {object} event
 * @param {string} [baseUrl] Base URL for blog/user profile links
 * @returns {object}
 */
export function extractEventMetadata(event, baseUrl = 'https://blog.emre.xyz') {
  if (!event) return {};

  const tags = event.tags || [];
  const content = event.content || '';
  const { category, subCategory } = classifyEvent(event);

  let title =
    getTagValue(tags, 'title') ||
    getTagValue(tags, 'name') ||
    '';

  const dTag = getTagValue(tags, 'd') || '';
  if (!title && dTag && !dTag.toLowerCase().startsWith('goodreads:') && !dTag.toLowerCase().startsWith('letterboxd:') && !dTag.toLowerCase().startsWith('imdb:') && !dTag.toLowerCase().startsWith('tmdb:') && !dTag.toLowerCase().startsWith('isbn:')) {
    title = dTag;
  }

  const summary =
    getTagValue(tags, 'summary') ||
    getTagValue(tags, 'description') ||
    getTagValue(tags, 'alt') ||
    '';

  let author = getTagValue(tags, 'author') || getTagValue(tags, 'creator') || getTagValue(tags, 'writer') || null;
  let year = getTagValue(tags, 'year') || getTagValue(tags, 'release_date') || null;

  // Extract title/author/year from Goodreads / Letterboxd / IMDb / review content if missing or placeholder
  if (!title || title.toLowerCase() === 'book' || title.toLowerCase() === 'movie' || title.toLowerCase().startsWith('isbn:') || title.toLowerCase().startsWith('imdb:') || !author) {
    const movieMatch = content.match(/for\s+["“](.+?)["”](?:\s+\((\d{4})\))?(?:\s+by\s+([^.\n]+))?/i);
    if (movieMatch) {
      if (!title || title.toLowerCase() === 'book' || title.toLowerCase() === 'movie' || title.toLowerCase().startsWith('isbn:') || title.toLowerCase().startsWith('imdb:')) {
        title = movieMatch[1].trim();
      }
      if (movieMatch[2] && !year) {
        year = movieMatch[2].trim();
      }
      if (movieMatch[3] && !author) {
        author = movieMatch[3].trim();
      }
    } else {
      const bookMatch = content.match(/for\s+["“](.+?)["”]\s+by\s+([^.\n]+)/i);
      if (bookMatch) {
        if (!title || title.toLowerCase() === 'book' || title.toLowerCase().startsWith('isbn:')) {
          title = bookMatch[1].trim();
        }
        if (!author) {
          author = bookMatch[2].trim();
        }
      } else if (!author) {
        const authorMatch = content.match(/\s+by\s+([^.\n]+?)(?:\.\s*Migrated|\.|$)/i);
        if (authorMatch) {
          author = authorMatch[1].trim();
        }
      }
    }
  }

  const image =
    getTagValue(tags, 'image') ||
    getTagValue(tags, 'thumb') ||
    getTagValue(tags, 'cover') ||
    getTagValue(tags, 'poster') ||
    getTagValue(tags, 'url') ||
    (content.match(URL_REGEX) || []).find((u) => IMAGE_EXT_REGEX.test(u)) ||
    null;

  const rating = extractRating(tags, content);

  const isbn = getTagValue(tags, 'isbn') || null;
  const imdb = getTagValue(tags, 'imdb') || null;
  const tmdb = getTagValue(tags, 'tmdb') || null;

  // External URLs (e.g. blog.emre.xyz for user articles, habla.news/njump for liked articles)
  let externalUrl = null;
  if (category === 'articles') {
    const isOwner = event.pubkey === OWNER_PUBKEY;
    if (isOwner) {
      // Link directly to user's blog
      const slug = dTag || (title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : event.id);
      externalUrl = `${baseUrl}/${slug}`;
    } else {
      // Third-party / liked article: link to habla.news or njump.me
      const externalUrlTag = getTagValue(tags, 'url') || getTagValue(tags, 'r');
      if (externalUrlTag && externalUrlTag.startsWith('http')) {
        externalUrl = externalUrlTag;
      } else if (dTag) {
        externalUrl = `https://habla.news/a/${event.pubkey}/${dTag}`;
      } else {
        externalUrl = `https://njump.me/${event.id}`;
      }
    }
  } else if (category === 'books') {
    if (isbn) {
      externalUrl = `https://bookstr.xyz/b/${isbn}`;
    } else if (dTag) {
      externalUrl = `https://bookstr.xyz/p/${event.pubkey}/${dTag}`;
    }
  } else if (category === 'movies') {
    if (imdb) {
      externalUrl = imdb.startsWith('http') ? imdb : `https://www.imdb.com/title/${imdb}`;
    } else if (tmdb) {
      externalUrl = tmdb.startsWith('http') ? tmdb : `https://www.themoviedb.org/movie/${tmdb}`;
    }
  }

  // Extract items/references in lists and sets
  const items = [];
  
  // Also find all 'i' tags (NIP-51 / Bookstr / Movie item identifiers)
  tags.forEach((t) => {
    if (!Array.isArray(t)) return;
    const tagType = t[0];
    const rawVal = t[1];
    if (!rawVal) return;

    if (tagType === 'isbn') {
      const cleanIsbn = rawVal.replace(/[^0-9X]/gi, '');
      const rawTitle = (t[2] || '').trim();
      const isPlaceholder = !rawTitle || rawTitle.toLowerCase() === 'book' || rawTitle.toLowerCase() === 'books' || rawTitle.toLowerCase() === 'isbn' || rawTitle.replace(/[^0-9X]/gi, '') === cleanIsbn;
      const cleanTitle = isPlaceholder ? null : rawTitle;
      items.push({
        type: 'isbn',
        raw: rawVal,
        value: cleanIsbn,
        isbn: cleanIsbn,
        title: cleanTitle,
        coverUrl: cleanIsbn ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg` : null,
        bookstrUrl: cleanIsbn ? `https://bookstr.xyz/b/${cleanIsbn}` : null,
        openLibraryUrl: cleanIsbn ? `https://openlibrary.org/isbn/${cleanIsbn}` : null
      });
    } else if (tagType === 'imdb') {
      const cleanImdb = rawVal.replace(/^imdb:/i, '').replace(/^https?:\/\/(?:www\.)?imdb\.com\/title\//i, '').replace(/\/.*$/, '').trim();
      const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : (cleanImdb.startsWith('tt') ? `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg` : null);
      items.push({
        type: 'imdb',
        raw: rawVal,
        value: cleanImdb,
        title: t[2] || `IMDb: ${cleanImdb}`,
        posterUrl,
        imdbUrl: cleanImdb ? `https://www.imdb.com/title/${cleanImdb}` : null
      });
    } else if (tagType === 'tmdb') {
      const cleanTmdb = rawVal.replace(/^tmdb:/i, '').replace(/^https?:\/\/(?:www\.)?themoviedb\.org\/movie\//i, '').replace(/^movie\//i, '').replace(/\/.*$/, '').trim();
      const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : null;
      items.push({
        type: 'tmdb',
        raw: rawVal,
        value: cleanTmdb,
        title: t[2] || `TMDb: ${cleanTmdb}`,
        posterUrl,
        tmdbUrl: cleanTmdb ? `https://www.themoviedb.org/movie/${cleanTmdb}` : null
      });
    } else if (tagType === 'movie') {
      const cleanVal = rawVal.trim();
      const isImdb = cleanVal.startsWith('tt') || cleanVal.includes('imdb.com');
      const cleanImdb = isImdb ? cleanVal.replace(/^https?:\/\/(?:www\.)?imdb\.com\/title\//i, '').replace(/\/.*$/, '').trim() : null;
      const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : (cleanImdb ? `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg` : null);
      items.push({
        type: isImdb ? 'imdb' : 'movie',
        raw: rawVal,
        value: cleanImdb || cleanVal,
        title: t[2] || (cleanImdb ? `IMDb: ${cleanImdb}` : cleanVal),
        posterUrl,
        imdbUrl: cleanImdb ? `https://www.imdb.com/title/${cleanImdb}` : null
      });
    } else if (tagType === 'i') {
      if (rawVal.toLowerCase().startsWith('isbn:') || /^[0-9]{10,13}$/.test(rawVal)) {
        const cleanIsbn = rawVal.replace(/^isbn:/i, '').replace(/[^0-9X]/gi, '');
        const rawTitle = (t[2] || '').trim();
        const isPlaceholder = !rawTitle || rawTitle.toLowerCase() === 'book' || rawTitle.toLowerCase() === 'books' || rawTitle.toLowerCase() === 'isbn' || rawTitle.replace(/[^0-9X]/gi, '') === cleanIsbn;
        const cleanTitle = isPlaceholder ? null : rawTitle;
        items.push({
          type: 'isbn',
          raw: rawVal,
          value: cleanIsbn,
          isbn: cleanIsbn,
          title: cleanTitle,
          coverUrl: cleanIsbn ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg` : null,
          bookstrUrl: cleanIsbn ? `https://bookstr.xyz/b/${cleanIsbn}` : null,
          openLibraryUrl: cleanIsbn ? `https://openlibrary.org/isbn/${cleanIsbn}` : null
        });
      } else if (rawVal.toLowerCase().startsWith('imdb:') || /^tt\d+/i.test(rawVal)) {
        const cleanImdb = rawVal.replace(/^imdb:/i, '').replace(/^https?:\/\/(?:www\.)?imdb\.com\/title\//i, '').replace(/\/.*$/, '').trim();
        const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : (cleanImdb.startsWith('tt') ? `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg` : null);
        items.push({
          type: 'imdb',
          raw: rawVal,
          value: cleanImdb,
          title: t[2] || `IMDb: ${cleanImdb}`,
          posterUrl,
          imdbUrl: cleanImdb ? `https://www.imdb.com/title/${cleanImdb}` : null
        });
      } else if (rawVal.toLowerCase().startsWith('tmdb:')) {
        const cleanTmdb = rawVal.replace(/^tmdb:(?:movie\/)?/i, '').replace(/^https?:\/\/(?:www\.)?themoviedb\.org\/movie\//i, '').replace(/\/.*$/, '').trim();
        const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : null;
        items.push({
          type: 'tmdb',
          raw: rawVal,
          value: cleanTmdb,
          title: t[2] || `TMDb: ${cleanTmdb}`,
          posterUrl,
          tmdbUrl: cleanTmdb ? `https://www.themoviedb.org/movie/${cleanTmdb}` : null
        });
      } else if (rawVal.toLowerCase().startsWith('movie:')) {
        const cleanVal = rawVal.replace(/^movie:/i, '').trim();
        const isImdb = cleanVal.startsWith('tt') || cleanVal.includes('imdb.com');
        const cleanImdb = isImdb ? cleanVal.replace(/^https?:\/\/(?:www\.)?imdb\.com\/title\//i, '').replace(/\/.*$/, '').trim() : null;
        const posterUrl = (t[3] && (t[3].startsWith('http://') || t[3].startsWith('https://'))) ? t[3] : (cleanImdb ? `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg` : null);
        items.push({
          type: isImdb ? 'imdb' : 'movie',
          raw: rawVal,
          value: cleanImdb || cleanVal,
          title: t[2] || (cleanImdb ? `IMDb: ${cleanImdb}` : cleanVal),
          posterUrl,
          imdbUrl: cleanImdb ? `https://www.imdb.com/title/${cleanImdb}` : null
        });
      } else {
        items.push({
          type: 'i',
          raw: rawVal,
          value: rawVal,
          title: t[2] || rawVal
        });
      }
    } else if (tagType === 'r') {
      const isImdbUrl = /imdb\.com\/title\/(tt\d+)/i.test(rawVal);
      const isTmdbUrl = /themoviedb\.org\/movie\/(\d+)/i.test(rawVal);
      if (isImdbUrl) {
        const match = rawVal.match(/imdb\.com\/title\/(tt\d+)/i);
        const cleanImdb = match ? match[1] : rawVal;
        items.push({
          type: 'imdb',
          raw: rawVal,
          value: cleanImdb,
          title: t[2] || `IMDb: ${cleanImdb}`,
          posterUrl: (t[3] && t[3].startsWith('http')) ? t[3] : `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg`,
          imdbUrl: `https://www.imdb.com/title/${cleanImdb}`
        });
      } else if (isTmdbUrl) {
        const match = rawVal.match(/themoviedb\.org\/movie\/(\d+)/i);
        const cleanTmdb = match ? match[1] : rawVal;
        items.push({
          type: 'tmdb',
          raw: rawVal,
          value: cleanTmdb,
          title: t[2] || `TMDb: ${cleanTmdb}`,
          posterUrl: (t[3] && t[3].startsWith('http')) ? t[3] : null,
          tmdbUrl: `https://www.themoviedb.org/movie/${cleanTmdb}`
        });
      } else {
        items.push({
          type: 'r',
          raw: rawVal,
          value: rawVal,
          title: t[2] || null,
          relay: t[2] || null,
          marker: t[3] || null
        });
      }
    } else if (tagType === 'a') {
      const parts = rawVal.split(':');
      const itemKind = parseInt(parts[0], 10);
      const itemDTag = parts.slice(2).join(':');
      const itemTitle = (t[3] && !t[3].startsWith('wss://')) ? t[3] : (t[2] && !t[2].startsWith('wss://')) ? t[2] : null;
      const cleanImdb = itemDTag.startsWith('tt') ? itemDTag : (itemDTag.match(/tt\d+/) ? itemDTag.match(/tt\d+/)[0] : null);

      if (cleanImdb) {
        items.push({
          type: 'imdb',
          raw: rawVal,
          value: cleanImdb,
          title: itemTitle || `IMDb: ${cleanImdb}`,
          posterUrl: `https://images.metahub.space/poster/medium/${cleanImdb}/img.jpg`,
          imdbUrl: `https://www.imdb.com/title/${cleanImdb}`
        });
      } else if (itemKind === 31985 || itemKind === 1985 || itemKind === 31989 || itemKind === 31922 || itemKind === 31923) {
        items.push({
          type: 'movie',
          raw: rawVal,
          value: itemDTag || rawVal,
          title: itemTitle || itemDTag.replace(/^(?:movie|letterboxd|goodreads):/i, '') || rawVal,
          posterUrl: null
        });
      } else {
        items.push({
          type: 'a',
          raw: rawVal,
          value: rawVal,
          title: itemTitle || itemDTag || null,
          relay: t[2] || null,
          marker: t[3] || null
        });
      }
    } else if (tagType === 'e') {
      const itemTitle = (t[3] && !t[3].startsWith('wss://')) ? t[3] : (t[2] && !t[2].startsWith('wss://')) ? t[2] : null;
      items.push({
        type: 'e',
        raw: rawVal,
        value: rawVal,
        title: itemTitle || rawVal
      });
    } else if (
      tagType === 'p' ||
      tagType === 't' ||
      tagType === 'server' ||
      tagType === 'clone' ||
      tagType === 'web' ||
      tagType === 'rel'
    ) {
      items.push({
        type: tagType,
        raw: rawVal,
        value: rawVal,
        title: t[2] || null,
        relay: t[2] || null,
        marker: t[3] || null
      });
    }
  });

  const firstIsbn = (items.find((i) => i.type === 'isbn') || {}).value || isbn;
  const firstImdb = (items.find((i) => i.type === 'imdb') || {}).value || imdb;
  const firstTmdb = (items.find((i) => i.type === 'tmdb') || {}).value || tmdb;
  const firstItemPoster = (items.find((i) => i.posterUrl) || {}).posterUrl;

  return {
    category,
    subCategory,
    title,
    summary,
    image: image || (firstIsbn ? `https://covers.openlibrary.org/b/isbn/${firstIsbn}-M.jpg` : null) || firstItemPoster || null,
    rating,
    author,
    year,
    isbn: firstIsbn,
    imdb: firstImdb,
    tmdb: firstTmdb,
    dTag,
    externalUrl,
    items,
    itemCount: items.length
  };
}
