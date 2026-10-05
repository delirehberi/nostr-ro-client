import { nip19 } from 'nostr-tools';
import { CATEGORIES_CONFIG } from './kinds.js';

const HEX_ID_REGEX = /^[0-9a-f]{64}$/i;

/**
 * Decode the id part of a `/p/<id>` path (hex, note1… or nevent1…) to a hex event id.
 *
 * @param {string} rawId
 * @returns {string|null} 64-char hex id, or null when it is not a valid id
 */
export function decodePostId(rawId) {
  if (typeof rawId !== 'string') return null;
  if (HEX_ID_REGEX.test(rawId)) return rawId.toLowerCase();
  try {
    const decoded = nip19.decode(rawId);
    if (decoded.type === 'note') return decoded.data;
    if (decoded.type === 'nevent') return decoded.data.id;
  } catch (_) {}
  return null;
}

/**
 * Resolve category/sub from query params, falling back to Notes/all for unknown values.
 *
 * @param {URLSearchParams} params
 * @returns {{category: string, sub: string}}
 */
export function parseFilterParams(params) {
  const category = CATEGORIES_CONFIG.find((c) => c.id === params.get('kind'));
  if (!category) return { category: 'notes', sub: 'all' };
  const sub = (category.subFilters || []).some((s) => s.id === params.get('sub'))
    ? params.get('sub')
    : 'all';
  return { category: category.id, sub };
}

/**
 * Parse `window.location`-like input into app state.
 *
 * @param {{pathname: string, search: string}} location
 * @returns {{view: 'post', postId: string|null} | {view: 'feed', category: string, sub: string}}
 */
export function parseLocation({ pathname, search }) {
  if (pathname.startsWith('/p/')) {
    return { view: 'post', postId: decodePostId(pathname.slice(3)) };
  }
  return { view: 'feed', ...parseFilterParams(new URLSearchParams(search)) };
}

/**
 * Build the feed URL for a category/sub pair (defaults are omitted).
 *
 * @param {string} category
 * @param {string} sub
 * @returns {string}
 */
export function buildFeedUrl(category, sub) {
  const params = new URLSearchParams();
  if (category !== 'notes') params.set('kind', category);
  if (sub !== 'all') params.set('sub', sub);
  const query = params.toString();
  return '/' + (query ? '?' + query : '');
}
