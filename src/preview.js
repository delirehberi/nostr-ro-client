/**
 * Link previews for shared `/p/<id>` posts.
 *
 * Crawlers don't run the SPA, so the Worker looks the post up on the relays and
 * injects Open Graph / Twitter card tags into the otherwise static index.html.
 * Only the owner's own, signature-checked events are used, all injected text is
 * escaped, and any failure falls back to the untouched page.
 */

import { acceptEvent } from './eventValidation.js';
import { decodePostId } from './urlState.js';
import { OWNER_PUBKEY, OWNER_HANDLE } from './config.js';
import { extractEventMetadata, extractMedia } from './kinds.js';
import { IMAGE_EXT_REGEX, URL_REGEX } from './kinds/patterns.js';
import { safeHttpUrl } from './safeUrl.js';

const RELAY_TIMEOUT_MS = 2000;
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 200;
// Encrypted / private kinds: never put their content in a public preview.
const PRIVATE_KINDS = new Set([4, 13, 14, 1059]);

/** Ask one relay for an event by id over a Workers outbound WebSocket. Resolves to a verified event or null. */
async function queryRelayForEvent(relayUrl, id, timeout) {
  let ws = null;
  try {
    const res = await fetch(relayUrl.replace(/^ws/i, 'http'), { headers: { Upgrade: 'websocket' } });
    ws = res.webSocket;
    if (!ws) return null;
    ws.accept();
    const subId = `og_${id.slice(0, 8)}`;
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);
      const done = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      ws.addEventListener('message', (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[1] !== subId) return;
          if (data[0] === 'EVENT' && acceptEvent(data[2], { ids: [id] })) done(data[2]);
          else if (data[0] === 'EOSE' || data[0] === 'CLOSED') done(null);
        } catch (_) {}
      });
      ws.addEventListener('close', () => done(null));
      ws.addEventListener('error', () => done(null));
      ws.send(JSON.stringify(['REQ', subId, { ids: [id], limit: 1 }]));
    });
  } catch (_) {
    return null;
  } finally {
    try {
      ws && ws.close();
    } catch (_) {}
  }
}

/** First verified event any relay returns, or null when none does within the timeout. */
export async function fetchPostEvent(id, relays, timeout = RELAY_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let pending = relays.length;
    if (pending === 0) resolve(null);
    relays.forEach((url) =>
      queryRelayForEvent(url, id, timeout).then((event) => {
        if (event) resolve(event);
        else if (--pending === 0) resolve(null);
      })
    );
  });
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Plain-text version of a note: no URLs, no nostr: references, collapsed whitespace. */
function plainText(content) {
  return content
    .replace(/(?:nostr:)?\b(?:nevent|note|npub|nprofile|naddr)1[0-9a-z]{20,}\b/g, '')
    .replace(URL_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title, description and image for a post, or null when it must not be previewed. */
export function buildPreview(event) {
  if (!event || event.pubkey !== OWNER_PUBKEY || PRIVATE_KINDS.has(event.kind)) return null;

  const meta = extractEventMetadata(event);
  const text = plainText(event.content || '');
  const handle = OWNER_HANDLE.split('@')[0];

  const title = truncate(meta.title || text.split(/(?<=[.!?])\s|\n/)[0] || `Post by @${handle}`, TITLE_MAX);
  const description = truncate(meta.summary || text || `A post by @${handle} on Nostr`, DESCRIPTION_MAX);

  const contentImage = ((event.content || '').match(URL_REGEX) || []).find((u) => IMAGE_EXT_REGEX.test(u));
  const image = [extractMedia(event).find((m) => m.type === 'image')?.url, contentImage, meta.image]
    .map((u) => safeHttpUrl(u))
    .find((u) => u && u.startsWith('https://'));

  return { title, description, image: image || null };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Insert the preview tags into the page's HTML (replacing its `<title>`). */
export function injectPreview(html, preview, pageUrl) {
  const tag = (attr, key, value) => `    <meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  const tags = [
    tag('property', 'og:type', 'article'),
    tag('property', 'og:site_name', 'My Nostr Hub'),
    tag('property', 'og:url', pageUrl),
    tag('property', 'og:title', preview.title),
    tag('property', 'og:description', preview.description),
    tag('name', 'description', preview.description),
    tag('name', 'twitter:card', preview.image ? 'summary_large_image' : 'summary'),
    tag('name', 'twitter:title', preview.title),
    tag('name', 'twitter:description', preview.description),
  ];
  if (preview.image) {
    tags.push(tag('property', 'og:image', preview.image), tag('name', 'twitter:image', preview.image));
  }
  const title = `<title>${escapeHtml(preview.title)} | My Nostr Hub</title>`;
  // Replacer functions keep `$` sequences in post text from being read as replacement patterns.
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, () => title)
    .replace(/<\/head>/i, () => `${tags.join('\n')}\n  </head>`);
}

/**
 * Return `response` (the SPA's index.html for a `/p/<id>` URL) with preview tags
 * for that post, or `response` unchanged when anything goes wrong.
 */
export async function withPostPreview(request, response, relays, timeout) {
  try {
    if (!response.ok || !(response.headers.get('Content-Type') || '').includes('text/html')) return response;
    const url = new URL(request.url);
    const id = decodePostId(url.pathname.slice(3));
    if (!id) return response;

    const event = await fetchPostEvent(id, relays, timeout);
    const preview = buildPreview(event);
    if (!preview) return response;

    const html = await response.clone().text();
    return new Response(injectPreview(html, preview, `${url.origin}${url.pathname}`), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (_) {
    return response;
  }
}
