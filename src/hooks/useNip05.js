import { useState, useEffect } from 'react';
import { NIP05_ENDPOINT, parseNip05 } from '../nip05.js';

// key -> Promise<boolean>; one lookup per identifier/pubkey pair for the page's lifetime.
const lookups = new Map();

function verify(identifier, pubkey) {
  const key = `${pubkey}:${identifier}`;
  if (!lookups.has(key)) {
    const url = `${NIP05_ENDPOINT}?id=${encodeURIComponent(identifier)}&pubkey=${encodeURIComponent(pubkey)}`;
    lookups.set(
      key,
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => body?.verified === true)
        .catch(() => false)
    );
  }
  return lookups.get(key);
}

/**
 * True only after `identifier` has been verified for `pubkey` via the Worker.
 * A NIP-05 value in a profile is just a claim, so callers must not present it
 * as an identity until this returns true.
 */
export function useNip05(identifier, pubkey) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setVerified(false);
    if (!pubkey || !parseNip05(identifier)) return undefined;
    let cancelled = false;
    verify(identifier, pubkey).then((ok) => {
      if (!cancelled) setVerified(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [identifier, pubkey]);

  return verified;
}

export default useNip05;
