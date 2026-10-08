import { IMAGE_EXT_REGEX, VIDEO_EXT_REGEX } from './patterns.js';
import { getTagValue } from './tags.js';

/**
 * Parse one NIP-92 `imeta` tag (`["imeta", "url https://…", "m image/jpeg", …]`).
 * @param {string[]} tag
 * @returns {Record<string, string>}
 */
function parseImeta(tag) {
  const fields = {};
  tag.slice(1).forEach((entry) => {
    if (typeof entry !== 'string') return;
    const space = entry.indexOf(' ');
    if (space <= 0) return;
    const key = entry.slice(0, space);
    if (!(key in fields)) fields[key] = entry.slice(space + 1).trim();
  });
  return fields;
}

/**
 * Media attached to an event through tags rather than its content:
 * NIP-92 `imeta` tags (kinds 20/21/22 and any note), and the NIP-94 `url`/`m`
 * tags of kind 1063 file metadata.
 *
 * @param {object} event
 * @returns {{url: string, type: 'image'|'video', mime: string|null, dim: string|null, alt: string|null, blurhash: string|null}[]}
 */
export function extractMedia(event) {
  if (!event || !Array.isArray(event.tags)) return [];
  const media = [];
  const seen = new Set();

  const add = ({ url, m, dim, alt, blurhash }) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return;
    const clean = url.trim();
    if (seen.has(clean)) return;
    const mime = m ? m.toLowerCase() : null;
    let type;
    if (mime?.startsWith('video/') || (!mime && VIDEO_EXT_REGEX.test(clean))) type = 'video';
    else if (mime?.startsWith('image/') || (!mime && IMAGE_EXT_REGEX.test(clean))) type = 'image';
    else if (!mime && (event.kind === 21 || event.kind === 22)) type = 'video';
    else if (!mime && event.kind === 20) type = 'image';
    else return;
    seen.add(clean);
    media.push({ url: clean, type, mime, dim: dim || null, alt: alt || null, blurhash: blurhash || null });
  };

  event.tags.forEach((tag) => {
    if (Array.isArray(tag) && tag[0] === 'imeta') add(parseImeta(tag));
  });

  if (event.kind === 1063) {
    add({
      url: getTagValue(event.tags, 'url'),
      m: getTagValue(event.tags, 'm'),
      dim: getTagValue(event.tags, 'dim'),
      alt: getTagValue(event.tags, 'alt') || getTagValue(event.tags, 'summary') || event.content || null,
      blurhash: getTagValue(event.tags, 'blurhash'),
    });
  }

  return media;
}
