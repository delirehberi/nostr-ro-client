import { OWNER_PUBKEY } from '../config.js';
import { classifyEvent } from './classify.js';
import { buildAppDataContext } from './context/appData.js';
import { buildAppHandlerContext } from './context/appHandler.js';
import { buildGitContexts } from './context/git.js';
import { buildLabelContext } from './context/label.js';
import { extractQuotes } from './context/quotes.js';
import { buildReactionContext } from './context/reaction.js';
import { buildSnippetContext } from './context/snippet.js';
import { extractMedia } from './media.js';
import { IMAGE_EXT_REGEX, URL_REGEX } from './patterns.js';
import { extractRating, getTagValue } from './tags.js';

// Events are immutable, so metadata is computed once per event object and base URL.
// The result is shared between callers and must be treated as read-only.
const metadataCache = new WeakMap(); // event -> Map(baseUrl -> metadata)

/**
 * Extract structured metadata from any Nostr event
 * @param {object} event
 * @param {string} [baseUrl] Base URL for blog/user profile links
 * @returns {object}
 */
export function extractEventMetadata(event, baseUrl = 'https://blog.emre.xyz') {
  if (!event || typeof event !== 'object') return computeMetadata(event, baseUrl);
  let byBase = metadataCache.get(event);
  if (!byBase) {
    byBase = new Map();
    metadataCache.set(event, byBase);
  }
  if (!byBase.has(baseUrl)) byBase.set(baseUrl, computeMetadata(event, baseUrl));
  return byBase.get(baseUrl);
}

function computeMetadata(event, baseUrl) {
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

  const ctx = { tags, content, dTag, title, summary, image };
  const appContext = buildAppDataContext(event, ctx);
  const appHandlerContext = buildAppHandlerContext(event, ctx);
  const snippetContext = buildSnippetContext(event, ctx);
  const reactionContext = buildReactionContext(event, ctx);
  const labelContext = buildLabelContext(event, ctx);
  const { gitContext, repoContext } = buildGitContexts(event, ctx);
  const quotes = extractQuotes(event, ctx);

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
    quotes,
    media: extractMedia(event)
  };
}
