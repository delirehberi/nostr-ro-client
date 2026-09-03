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

import { nip19 } from 'nostr-tools';

/**
 * Encode addressable pointer (NIP-19 naddr)
 */
export function encodeNaddr(pubkey, kind, identifier, relays = []) {
  try {
    return nip19.naddrEncode({
      pubkey,
      kind: typeof kind === 'string' ? parseInt(kind, 10) : kind,
      identifier: identifier || '',
      relays: Array.isArray(relays) ? relays : []
    });
  } catch (_) {
    return null;
  }
}

/**
 * Encode public key to npub
 */
export function encodeNpub(pubkey) {
  try {
    return nip19.npubEncode(pubkey);
  } catch (_) {
    return pubkey;
  }
}

/**
 * Encode event pointer (NIP-19 nevent)
 */
export function encodeNevent(id, pubkey = null, kind = null, relays = []) {
  try {
    const data = { id };
    if (pubkey) data.author = pubkey;
    if (kind) data.kind = kind;
    if (relays && relays.length > 0) data.relays = relays;
    return nip19.neventEncode(data);
  } catch (_) {
    return null;
  }
}

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
    case 1337:
    case 31337:
      return '💻 Code Snippet';
    case 1617:
      return '💻 Git Patch (NIP-34)';
    case 1618:
      return '🔀 Git Pull Request (NIP-34)';
    case 1621:
      return '❗ Git Issue (NIP-34)';
    case 1622:
      return '💬 Git Review / Comment';
    case 1630:
      return '🟢 Git Status: Open';
    case 1631:
      return '🟣 Git Status: Applied';
    case 1632:
      return '🔴 Git Status: Closed';
    case 1633:
      return '⚪ Git Status: Draft';
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
    case 10017:
      return '💻 Git Follow List';
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
      return '🎬 Media Tracker';
    case 31989:
      return '⭐ App Recommendation';
    case 31990:
      return '📱 Nostr App (NIP-89)';
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

  // App Data Context (Kind 30078 / NIP-78 and app configs)
  const isAppDataKind = event.kind === 30078 || (event.kind >= 30000 && event.kind < 40000 && event.kind !== 31990 && event.kind !== 30617 && event.kind !== 30618 && (dTag.includes('metadata') || dTag.includes('settings') || dTag.includes('state') || dTag.includes('config') || dTag.includes('data')));
  const isBase64Blob = typeof content === 'string' && /^[A-Za-z0-9+/=\s]{40,}$/.test(content.trim()) && !content.trim().includes(' ');
  const isJsonBlob = typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('[')) && content.trim().length > 40;
  const isEncryptedOrRaw = isBase64Blob || isJsonBlob;

  let appContext = null;
  if (isAppDataKind || event.kind === 30078) {
    const rawAppName = dTag ? dTag.split(/[:\-_/]/)[0] : (title ? title.split(/[:\s]/)[0] : 'App');
    const appName = rawAppName ? rawAppName.charAt(0).toUpperCase() + rawAppName.slice(1) : 'Application';
    appContext = {
      isAppData: true,
      appName,
      identifier: dTag || title || `Kind ${event.kind}`,
      isEncryptedOrRaw,
      description: `Application configuration and state data stored on Nostr (NIP-78).`
    };
  }

  // NIP-89 Application Handler Context (Kind 31990 / 31989)
  let appHandlerContext = null;
  if (event.kind === 31990 || event.kind === 31989) {
    let appMeta = {};
    if (content && typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        appMeta = JSON.parse(content);
      } catch (_) {}
    }

    const appName = appMeta.name || getTagValue(tags, 'name') || title || dTag || 'Nostr App';
    const appAbout = appMeta.about || appMeta.description || getTagValue(tags, 'about') || getTagValue(tags, 'description') || summary || '';
    const appPicture = appMeta.picture || appMeta.image || appMeta.logo || getTagValue(tags, 'picture') || getTagValue(tags, 'image') || image || null;
    const appWebsite = appMeta.website || getTagValue(tags, 'website') || getTagValue(tags, 'web') || null;
    const appNip05 = appMeta.nip05 || getTagValue(tags, 'nip05') || null;
    const appBanner = appMeta.banner || getTagValue(tags, 'banner') || null;
    const supportedKinds = getAllTagValues(tags, 'k').map((k) => parseInt(k, 10)).filter((k) => !isNaN(k));
    const appNaddr = encodeNaddr(event.pubkey, event.kind, dTag);

    appHandlerContext = {
      isAppHandler: true,
      name: appName,
      about: appAbout,
      picture: appPicture,
      website: appWebsite,
      nip05: appNip05,
      banner: appBanner,
      supportedKinds,
      naddr: appNaddr,
      nostrhubUrl: appNaddr ? `https://nostrhub.io/a/${appNaddr}` : `https://nostrhub.io/a/${event.id}`
    };
  }

  // Code Snippet Context (Kind 1337 / 31337 / NIP-CO)
  let snippetContext = null;
  if (event.kind === 1337 || event.kind === 31337) {
    const rawTitle = title || getTagValue(tags, 'name') || dTag || 'code-snippet';
    const language = getTagValue(tags, 'l') || getTagValue(tags, 'extension') || (rawTitle.includes('.') ? rawTitle.split('.').pop() : 'code');
    const snippetDesc = summary || getTagValue(tags, 'description') || '';
    const snippetNaddr = event.kind === 31337 ? encodeNaddr(event.pubkey, event.kind, dTag) : null;
    
    snippetContext = {
      isSnippet: true,
      title: rawTitle,
      language: language.toLowerCase(),
      description: snippetDesc,
      naddr: snippetNaddr,
      snipsUrl: `https://snips.emre.xyz/#/s/${event.id}`
    };
  }

  // Reaction Context (Kind 7)
  let reactionContext = null;
  if (event.kind === 7) {
    const rawContent = (content || '+').trim();
    const targetEventId = getTagValue(tags, 'e');
    const targetAuthor = getTagValue(tags, 'p');
    const targetCoordinate = getTagValue(tags, 'a');

    reactionContext = {
      isReaction: true,
      reaction: rawContent || '+',
      targetEventId,
      targetAuthor,
      targetCoordinate
    };
  }

  // Label & Review Context (Kind 1985 / 31985 / NIP-32)
  const isLabelOrReview = event.kind === 1985 || event.kind === 31985 || tags.some((t) => Array.isArray(t) && (t[0] === 'L' || t[0] === 'l'));
  let labelContext = null;
  if (isLabelOrReview) {
    const namespaces = getAllTagValues(tags, 'L');
    const labelTags = tags
      .filter((t) => Array.isArray(t) && t[0] === 'l' && t[1])
      .map((t) => ({ value: t[1], namespace: t[2] || (namespaces[0] || null) }));

    let target = null;
    const iTag = tags.find((t) => Array.isArray(t) && t[0] === 'i' && t[1]);
    const rTag = tags.find((t) => Array.isArray(t) && t[0] === 'r' && t[1]);
    const eTag = tags.find((t) => Array.isArray(t) && t[0] === 'e' && t[1]);
    const pTag = tags.find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
    const aTag = tags.find((t) => Array.isArray(t) && t[0] === 'a' && t[1]);

    const targetUrl = (iTag && iTag[1].startsWith('http')) ? iTag[1] : (rTag && rTag[1].startsWith('http')) ? rTag[1] : null;
    if (targetUrl) {
      const ghMatch = targetUrl.match(/github\.com\/([^/]+\/[^/]+)(?:\/(?:blob|tree|issues|pull)\/[^/]+\/(.+)|(?:\/(?:blob|tree|issues|pull)\/(.+)))?/i);
      if (ghMatch) {
        const repo = ghMatch[1];
        const filePath = ghMatch[2] || ghMatch[3] || '';
        const fileName = filePath ? filePath.split('/').pop() : '';
        target = {
          type: 'github',
          url: targetUrl,
          repo,
          path: filePath,
          fileName,
          title: fileName ? `${repo}: ${fileName}` : repo
        };
      } else {
        target = {
          type: 'url',
          url: targetUrl,
          title: targetUrl.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '')
        };
      }
    } else if (iTag) {
      target = { type: 'identifier', value: iTag[1], title: iTag[2] || iTag[1] };
    } else if (eTag) {
      target = { type: 'event', eventId: eTag[1] };
    } else if (pTag) {
      target = { type: 'profile', pubkey: pTag[1] };
    } else if (aTag) {
      target = { type: 'coordinate', coordinate: aTag[1] };
    }

    labelContext = {
      isLabelOrReview: true,
      namespaces,
      labels: labelTags,
      target
    };
  }

  // Repository & Git Context (NIP-34 Git events & repo references)
  const isGitKind = event.kind === 1617 || event.kind === 1618 || event.kind === 1621 || event.kind === 1622 || (event.kind >= 1630 && event.kind <= 1633) || event.kind === 30617 || event.kind === 30618;
  const repoATags = tags.filter((t) => Array.isArray(t) && t[0] === 'a' && t[1] && t[1].startsWith('30617:'));
  const repoATag = repoATags[0] || null;
  const ghTag = tags.find((t) => Array.isArray(t) && (t[0] === 'r' || t[0] === 'i' || t[0] === 'u') && t[1] && t[1].includes('github.com/'));

  let repoContext = null;
  let gitContext = null;

  if (isGitKind || repoATag) {
    let repoName = dTag || title || 'Repository';
    let repoPubkey = event.pubkey;
    let repoIdentifier = dTag || '';

    if (repoATag) {
      const parts = repoATag[1].split(':');
      repoPubkey = parts[1] || repoPubkey;
      repoIdentifier = parts.slice(2).join(':') || repoIdentifier;
      repoName = repoIdentifier || repoName;
    }

    const repoNaddr = encodeNaddr(repoPubkey, 30617, repoIdentifier);
    const eventNaddr = (event.kind >= 30000 && event.kind < 40000) ? encodeNaddr(event.pubkey, event.kind, dTag) : null;
    const authorNpub = encodeNpub(event.pubkey);
    const repoOwnerNpub = encodeNpub(repoPubkey);

    const gitworkshopRepoUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}` : (repoPubkey && repoIdentifier ? `https://gitworkshop.dev/${repoOwnerNpub}/${repoIdentifier}` : null);
    
    let gitworkshopUrl = null;
    if (event.kind === 30617 || event.kind === 30618) {
      gitworkshopUrl = (eventNaddr ? `https://gitworkshop.dev/r/${eventNaddr}` : null) || gitworkshopRepoUrl;
    } else if (event.kind === 1618) {
      gitworkshopUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/pulls/${event.id}` : `https://gitworkshop.dev/p/${event.id}`;
    } else if (event.kind === 1621) {
      gitworkshopUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/issues/${event.id}` : `https://gitworkshop.dev/p/${event.id}`;
    } else if (event.kind === 1617) {
      gitworkshopUrl = `https://gitworkshop.dev/p/${event.id}`;
    } else {
      gitworkshopUrl = gitworkshopRepoUrl || `https://gitworkshop.dev/p/${event.id}`;
    }

    // Extract commits, branches, clone URLs, web URLs, relays
    const cloneUrls = getAllTagValues(tags, 'clone');
    const webUrls = getAllTagValues(tags, 'web');
    const relayUrls = [...getAllTagValues(tags, 'relays'), ...getAllTagValues(tags, 'server')];
    const maintainers = getAllTagValues(tags, 'maintainers');

    // Extract commit hashes (from commit tags, r tags, HEAD refs, or 40-char hex in content/tags)
    const commitHashes = new Set();
    tags.forEach((t) => {
      if (!Array.isArray(t)) return;
      const tagKey = t[0];
      const tagVal = t[1];
      if (tagKey === 'commit' && tagVal && /^[0-9a-f]{7,40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      } else if (tagKey === 'r' && tagVal && /^[0-9a-f]{40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      } else if (tagKey.startsWith('refs/heads/') && tagVal && /^[0-9a-f]{40}$/i.test(tagVal)) {
        commitHashes.add(tagVal);
      }
    });

    const commitBadges = Array.from(commitHashes).map((hash) => ({
      hash,
      shortHash: hash.slice(0, 7),
      url: repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}/commit/${hash}` : `https://gitworkshop.dev/r/${hash}`
    }));

    // Extract branch
    let branch = getTagValue(tags, 'branch');
    const headTag = getTagValue(tags, 'HEAD');
    if (!branch && headTag) {
      const match = headTag.match(/refs\/heads\/(.+)$/);
      if (match) branch = match[1];
    }
    if (!branch) {
      const refTag = tags.find((t) => Array.isArray(t) && t[0].startsWith('refs/heads/'));
      if (refTag) {
        branch = refTag[0].replace('refs/heads/', '');
      }
    }

    // Extract PR/Issue subject or title
    let subject = title || getTagValue(tags, 'subject') || getTagValue(tags, 'name') || '';
    if (!subject && content) {
      const prMatch = content.match(/^git\s+Pull\s+Request:\s*(.+)$/im);
      if (prMatch) {
        subject = prMatch[1].trim();
      } else if (!title) {
        const firstLine = content.split('\n')[0].trim();
        if (firstLine && firstLine.length < 80) subject = firstLine;
      }
    }

    gitContext = {
      isGit: true,
      kind: event.kind,
      repoName,
      repoPubkey,
      repoIdentifier,
      repoNaddr,
      repoOwnerNpub,
      gitworkshopRepoUrl,
      gitworkshopUrl,
      authorNpub,
      cloneUrls,
      webUrls,
      relayUrls,
      maintainers,
      commitBadges,
      branch,
      subject: subject || repoName
    };

    repoContext = {
      type: 'nip34',
      name: repoName,
      coordinate: repoATag ? repoATag[1] : (eventNaddr || repoName),
      pubkey: repoPubkey,
      title: subject || repoName,
      url: gitworkshopUrl
    };
  } else if (ghTag) {
    const ghUrl = ghTag[1];
    const ghMatch = ghUrl.match(/github\.com\/([^/]+\/[^/]+)(?:\/(?:blob|tree|issues|pull)\/[^/]+\/(.+)|(?:\/(?:blob|tree|issues|pull)\/(.+)))?/i);
    if (ghMatch) {
      const repo = ghMatch[1];
      const filePath = ghMatch[2] || ghMatch[3] || '';
      repoContext = {
        type: 'github',
        url: ghUrl,
        repo,
        path: filePath,
        name: repo,
        title: filePath ? `${repo}: ${filePath.split('/').pop()}` : repo
      };
    } else {
      repoContext = {
        type: 'url',
        url: ghUrl,
        name: ghUrl.replace(/^https?:\/\/(?:www\.)?/, ''),
        title: ghUrl
      };
    }
  }

  // Quoted events extraction
  const quotes = [];
  const quoteIds = new Set();

  // 1. Check 'q' tags and 'e' tags with mention marker
  tags.forEach((t) => {
    if (!Array.isArray(t)) return;
    if (t[0] === 'q' && t[1]) {
      quoteIds.add(t[1]);
      quotes.push({ id: t[1], relay: t[2] || null, pubkey: t[3] || null });
    } else if (t[0] === 'e' && t[1] && (t[3] === 'mention' || t[3] === 'quote')) {
      if (!quoteIds.has(t[1])) {
        quoteIds.add(t[1]);
        quotes.push({ id: t[1], relay: t[2] || null, pubkey: null });
      }
    }
  });

  // 2. Check content for inline mentions (nostr:nevent1..., nostr:note1..., [event:nevent1...])
  const quoteRegex = /(?:nostr:)?\b((?:nevent|note)1[0-9a-z]{20,})\b/g;
  let qMatch;
  while ((qMatch = quoteRegex.exec(content)) !== null) {
    const bech32 = qMatch[1];
    try {
      const decoded = nip19.decode(bech32);
      let targetId = null;
      let targetPubkey = null;
      if (decoded.type === 'note') {
        targetId = decoded.data;
      } else if (decoded.type === 'nevent') {
        targetId = decoded.data.id;
        targetPubkey = decoded.data.author || null;
      }
      if (targetId && !quoteIds.has(targetId) && targetId !== event.id) {
        quoteIds.add(targetId);
        quotes.push({ id: targetId, pubkey: targetPubkey, bech32 });
      }
    } catch (_) {}
  }

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
    itemCount: items.length,
    appContext,
    appHandlerContext,
    snippetContext,
    reactionContext,
    gitContext,
    labelContext,
    repoContext,
    quotes
  };
}

