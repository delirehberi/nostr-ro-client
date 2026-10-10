/**
 * NIP-05 verification. A NIP-05 identifier in a profile is only a claim; it is
 * verified by fetching `https://<domain>/.well-known/nostr.json?name=<name>`
 * and comparing the pubkey it returns. The Worker does the fetch (see
 * `handleNip05`) so the browser needs no `connect-src` for arbitrary domains
 * and CORS on the identity server does not matter.
 */

const NAME_RE = /^[a-z0-9._-]+$/i;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i; // needs a letters-only TLD, so no IPs
const PUBKEY_RE = /^[0-9a-f]{64}$/i;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_CHARS = 256 * 1024;

export const NIP05_ENDPOINT = '/api/nip05';

/** Split `name@domain` (a bare `domain` means `_@domain`). Returns null when it is not a plausible identifier. */
export function parseNip05(identifier) {
  if (typeof identifier !== 'string') return null;
  const trimmed = identifier.trim();
  if (!trimmed || trimmed.length > 320) return null;
  const at = trimmed.lastIndexOf('@');
  const name = at === -1 ? '_' : trimmed.slice(0, at);
  const domain = at === -1 ? trimmed : trimmed.slice(at + 1);
  if (!NAME_RE.test(name) || !DOMAIN_RE.test(domain)) return null;
  return { name: name.toLowerCase(), domain: domain.toLowerCase() };
}

/** True when a nostr.json document maps `name` to `pubkey`. */
export function nostrJsonMatches(json, name, pubkey) {
  if (!json || typeof json !== 'object' || !json.names || typeof json.names !== 'object') return false;
  const mapped = Object.prototype.hasOwnProperty.call(json.names, name) ? json.names[name] : null;
  return typeof mapped === 'string' && PUBKEY_RE.test(mapped) && mapped.toLowerCase() === pubkey.toLowerCase();
}

async function verifyNip05(identifier, pubkey) {
  const parsed = parseNip05(identifier);
  if (!parsed || typeof pubkey !== 'string' || !PUBKEY_RE.test(pubkey)) return false;
  try {
    const res = await fetch(
      `https://${parsed.domain}/.well-known/nostr.json?name=${encodeURIComponent(parsed.name)}`,
      {
        headers: { Accept: 'application/json' },
        redirect: 'manual', // NIP-05: redirects must not be followed
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return false;
    const text = await res.text();
    if (text.length > MAX_BODY_CHARS) return false;
    return nostrJsonMatches(JSON.parse(text), parsed.name, pubkey);
  } catch (_) {
    return false;
  }
}

/** Worker handler for `GET /api/nip05?id=<name@domain>&pubkey=<hex>` -> `{ "verified": boolean }`. */
export async function handleNip05(request) {
  const headers = { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
  }
  const params = new URL(request.url).searchParams;
  const verified = await verifyNip05(params.get('id'), params.get('pubkey'));
  return new Response(JSON.stringify({ verified }), {
    headers: { ...headers, 'Cache-Control': `public, max-age=${verified ? 3600 : 300}` },
  });
}
