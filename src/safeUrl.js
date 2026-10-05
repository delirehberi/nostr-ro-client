/**
 * Return `value` when it is an absolute http(s) URL, otherwise null.
 *
 * Every URL that comes from event data (tags, content JSON, profiles) must go
 * through this before it reaches an `href` or `src`, so `javascript:`, `data:`
 * and similar schemes can never be rendered.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch (_) {
    return null;
  }
}
