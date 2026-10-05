import { verifyEvent } from 'nostr-tools';

/**
 * Check that an event returned by a relay actually answers the filter we sent
 * (author, kind and id constraints) and that its id/signature are valid.
 *
 * @param {object} event
 * @param {{authors?: string[], kinds?: number[], ids?: string[]}} [filter]
 * @returns {boolean}
 */
export function acceptEvent(event, filter = {}) {
  if (!event || typeof event !== 'object') return false;
  if (typeof event.id !== 'string' || typeof event.pubkey !== 'string') return false;
  if (typeof event.kind !== 'number' || typeof event.created_at !== 'number') return false;
  if (!Array.isArray(event.tags) || typeof event.content !== 'string') return false;

  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.ids && !filter.ids.includes(event.id)) return false;

  try {
    return verifyEvent(event);
  } catch (_) {
    return false;
  }
}
