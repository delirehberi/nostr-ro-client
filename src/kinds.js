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

export { encodeNaddr, encodeNpub, encodeNevent } from './kinds/nip19.js';
export { CATEGORIES_CONFIG, CATEGORY_KINDS_MAP } from './kinds/categories.js';
export { getTagValue, getAllTagValues, extractRating } from './kinds/tags.js';
export { getKindLabel } from './kinds/labels.js';
export { eventAddress, isNewerVersion } from './kinds/addressing.js';
export { classifyEvent } from './kinds/classify.js';
export { extractMedia } from './kinds/media.js';
export { extractEventMetadata } from './kinds/metadata.js';
