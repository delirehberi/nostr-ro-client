import { DEFAULT_RELAYS } from './relays.js';
import { NIP05_ENDPOINT, handleNip05 } from './nip05.js';
import { withPostPreview } from './preview.js';

/**
 * Worker entry: serves the built SPA from static assets and adds caching and
 * security headers. All Nostr traffic happens in the browser.
 */

// Hashed build output is safe to cache forever; HTML must always revalidate.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE = 'no-cache';

// Trusted hosts: the Nostr relays, the metadata APIs, and the shared emre.xyz header/footer assets.
// Event content may embed arbitrary https images/video/fonts, hence the https: sources there.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://emre.xyz",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://emre.xyz",
  'font-src https: data:',
  'img-src https: data:',
  'media-src https:',
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  `connect-src 'self' ${DEFAULT_RELAYS.join(' ')} https://openlibrary.org https://v3-cinemeta.strem.io https://emre.xyz`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self' https://emre.xyz",
].join('; ');

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  // A missing /assets/ file falls back to index.html, which must not be cached as immutable.
  const isHtml = (headers.get('Content-Type') || '').includes('text/html');
  const isHashedAsset = pathname.startsWith('/assets/') && response.ok && !isHtml;
  headers.set('Cache-Control', isHashedAsset ? IMMUTABLE_CACHE : REVALIDATE_CACHE);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Content-Security-Policy', CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === NIP05_ENDPOINT) {
      return handleNip05(request);
    }
    if (env && env.ASSETS) {
      const { pathname } = new URL(request.url);
      let response = await env.ASSETS.fetch(request);
      if (request.method === 'GET' && pathname.startsWith('/p/')) {
        response = await withPostPreview(request, response, DEFAULT_RELAYS);
      }
      return withHeaders(response, pathname);
    }
    return new Response('Nostr Client SPA', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
