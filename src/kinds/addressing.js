/**
 * NIP-01 address of a replaceable or addressable event, or null for regular events.
 * Kinds 0, 3 and 10000–19999 are keyed by `kind:pubkey`; kinds 30000–39999 by
 * `kind:pubkey:d`, the same form used in `a` tags.
 *
 * @param {object} event
 * @returns {string|null}
 */
export function eventAddress(event) {
  if (!event || typeof event.kind !== 'number' || typeof event.pubkey !== 'string') return null;
  const { kind, pubkey } = event;
  if (kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000)) return `${kind}:${pubkey}`;
  if (kind >= 30000 && kind < 40000) {
    const dTag = (event.tags || []).find((t) => Array.isArray(t) && t[0] === 'd');
    return `${kind}:${pubkey}:${dTag?.[1] ?? ''}`;
  }
  return null;
}

/**
 * Whether `a` supersedes `b` as a version of the same address: newer
 * `created_at` wins, ties go to the lowest id (NIP-01).
 */
export function isNewerVersion(a, b) {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at;
  return a.id < b.id;
}
