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
