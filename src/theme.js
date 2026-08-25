/**
 * Nostr Profile Themes (Kind 16767 & Kind 36767) Parser & Style Generator
 * Spec: https://nostrhub.io/naddr1qvzqqqrcvypzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqq88qun0ve5kcefdw35x2mt9wvvxzjzm
 */

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SAFE_FONT_FAMILY_REGEX = /^[a-zA-Z0-9\s\-]+$/;
const SAFE_URL_REGEX = /^https?:\/\/[^\s"'`<>]+$/;

/**
 * Validate and normalize a hex color code.
 * @param {string} color
 * @returns {string|null}
 */
export function sanitizeHexColor(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) {
    if (trimmed.length === 4) {
      return (
        '#' +
        trimmed[1] +
        trimmed[1] +
        trimmed[2] +
        trimmed[2] +
        trimmed[3] +
        trimmed[3]
      ).toLowerCase();
    }
    return trimmed.toLowerCase();
  }
  return null;
}

/**
 * Sanitize a font family name.
 * @param {string} family
 * @returns {string|null}
 */
export function sanitizeFontFamily(family) {
  if (typeof family !== 'string') return null;
  const trimmed = family.trim();
  if (SAFE_FONT_FAMILY_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Sanitize a URL to prevent CSS injection.
 * @param {string} url
 * @returns {string|null}
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (SAFE_URL_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Calculate relative luminance of a hex color (0 to 1) per WCAG 2.1.
 * @param {string} hexColor
 * @returns {number}
 */
export function getRelativeLuminance(hexColor) {
  const hex = sanitizeHexColor(hexColor) || '#000000';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Parse an active theme event (Kind 16767) or theme definition (Kind 36767).
 * @param {object} event Nostr event
 * @param {Map<string, object>} [referencedThemeMap] Optional map of referenced 36767 events
 * @returns {object|null} Parsed theme or null if invalid
 */
export function parseThemeEvent(event, referencedThemeMap) {
  if (!event || !Array.isArray(event.tags)) {
    return null;
  }

  let targetEvent = event;

  // If this is a Kind 16767 that references a Kind 36767 via 'a' or 'e' tag
  if (event.kind === 16767 && referencedThemeMap) {
    const aTag = event.tags.find((t) => t[0] === 'a' && t[1]);
    const eTag = event.tags.find((t) => t[0] === 'e' && t[1]);
    if (aTag && referencedThemeMap.has(aTag[1])) {
      targetEvent = referencedThemeMap.get(aTag[1]);
    } else if (eTag && referencedThemeMap.has(eTag[1])) {
      targetEvent = referencedThemeMap.get(eTag[1]);
    }
  }

  const tags = targetEvent.tags || [];

  // Parse colors
  let background = null;
  let text = null;
  let primary = null;

  for (const tag of tags) {
    if (tag[0] === 'c' && tag[1] && tag[2]) {
      const sanitized = sanitizeHexColor(tag[1]);
      const role = String(tag[2]).toLowerCase().trim();
      if (sanitized) {
        if (role === 'background' && !background) background = sanitized;
        else if (role === 'text' && !text) text = sanitized;
        else if (role === 'primary' && !primary) primary = sanitized;
      }
    }
  }

  // Parse fonts
  const fonts = [];
  const seenRoles = new Set();

  for (const tag of tags) {
    if (tag[0] === 'f' && tag[1] && tag[2]) {
      const family = sanitizeFontFamily(tag[1]);
      const url = sanitizeUrl(tag[2]);
      const role = tag[3] ? String(tag[3]).toLowerCase().trim() : 'body';

      if (family && url && (role === 'body' || role === 'title') && !seenRoles.has(role)) {
        seenRoles.add(role);
        fonts.push({ family, url, role });
      }
    }
  }

  // Parse background media tag: ["bg", "url ...", "mode ...", "m ...", "dim ..."]
  let backgroundMedia = null;
  const bgTag = tags.find((t) => t[0] === 'bg');
  if (bgTag && bgTag.length > 1) {
    const bgProps = {};
    for (let i = 1; i < bgTag.length; i++) {
      const part = bgTag[i];
      if (typeof part === 'string') {
        const spaceIdx = part.indexOf(' ');
        if (spaceIdx > 0) {
          const key = part.slice(0, spaceIdx).trim().toLowerCase();
          const val = part.slice(spaceIdx + 1).trim();
          bgProps[key] = val;
        }
      }
    }

    const bgUrl = sanitizeUrl(bgProps.url);
    if (bgUrl) {
      backgroundMedia = {
        url: bgUrl,
        mode: bgProps.mode === 'tile' ? 'tile' : 'cover',
        mime: bgProps.m || 'image/jpeg',
        dim: bgProps.dim || null,
        blurhash: bgProps.blurhash || null
      };
    }
  }

  const titleTag = tags.find((t) => t[0] === 'title' && t[1]);
  const title = titleTag ? String(titleTag[1]).trim() : null;

  // Fallbacks if some colors are missing but at least one was present
  if (!background && !text && !primary && fonts.length === 0 && !backgroundMedia) {
    return null;
  }

  return {
    background: background || '#ffffff',
    text: text || '#1e293b',
    primary: primary || '#3b82f6',
    fonts,
    backgroundMedia,
    title
  };
}

/**
 * Generate CSS rules and custom properties for a parsed theme.
 * @param {object} theme Parsed theme object
 * @returns {string} CSS style string
 */
export function generateThemeCss(theme) {
  if (!theme) return '';

  const { background, text, primary, fonts = [], backgroundMedia } = theme;
  const isDark = getRelativeLuminance(background) < 0.2;

  // Derived colors
  const meta = isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748b';
  const border = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  const parentBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9';
  const containerBg = background;
  const blockquote = isDark ? 'rgba(255, 255, 255, 0.07)' : '#f8fafc';

  let fontFaceDeclarations = '';
  let bodyFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  let titleFontFamily = bodyFontFamily;

  for (const font of fonts) {
    fontFaceDeclarations += `
    @font-face {
      font-family: "${font.family}";
      src: url("${font.url}") format("woff2");
      font-display: swap;
    }`;

    if (font.role === 'body') {
      bodyFontFamily = `"${font.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }
    if (font.role === 'title') {
      titleFontFamily = `"${font.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }
  }

  // If only body font was provided, fallback title to body font
  if (fonts.some((f) => f.role === 'body') && !fonts.some((f) => f.role === 'title')) {
    titleFontFamily = bodyFontFamily;
  }

  let bgStyles = '';
  if (backgroundMedia && backgroundMedia.url) {
    if (backgroundMedia.mode === 'tile') {
      bgStyles = `
      body {
        background-image: url("${backgroundMedia.url}");
        background-repeat: repeat;
      }`;
    } else {
      bgStyles = `
      body {
        background-image: url("${backgroundMedia.url}");
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
      }`;
    }
  }

  return `
    ${fontFaceDeclarations}
    
    :root, html {
      --bg: ${background};
      --container-bg: ${containerBg};
      --text: ${text};
      --primary: ${primary};
      --link: ${primary};
      --border: ${border};
      --meta: ${meta};
      --parent-bg: ${parentBg};
      --blockquote: ${blockquote};
      --font-body: ${bodyFontFamily};
      --font-title: ${titleFontFamily};
    }

    html, body {
      font-family: var(--font-body);
      background-color: var(--bg);
      color: var(--text);
    }

    header h1, .user-name {
      font-family: var(--font-title);
    }

    ${bgStyles}
  `;
}
