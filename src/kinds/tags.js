/**
 * Extract tag value helper
 * @param {Array<Array<string>>} tags
 * @param {string} tagName
 * @returns {string|null}
 */
export function getTagValue(tags, tagName) {
  if (!Array.isArray(tags)) return null;
  const match = tags.find((t) => Array.isArray(t) && t[0] === tagName && t[1]);
  return match ? match[1] : null;
}

/**
 * Extract all tag values helper
 * @param {Array<Array<string>>} tags
 * @param {string} tagName
 * @returns {Array<string>}
 */
export function getAllTagValues(tags, tagName) {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t) => Array.isArray(t) && t[0] === tagName && t[1])
    .map((t) => t[1]);
}

/**
 * Extract rating value (e.g. from NIP-32 label / review tags)
 * @param {Array<Array<string>>} tags
 * @param {string} content
 * @returns {number|null} 0.0 to 5.0 or 0 to 10
 */
export function extractRating(tags, content = '') {
  // 1. Check content first for explicit text like "Rated 5/5 stars" or "★★★★☆"
  if (content) {
    const scoreMatch = content.match(/(?:rated|rating|score|puan)(?::|\s+)\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      const max = parseFloat(scoreMatch[2]);
      if (max > 0) return (score / max) * 5;
    }
    const starMatches = content.match(/[★⭐]/g);
    if (starMatches && starMatches.length > 0 && starMatches.length <= 10) {
      return Math.min(5, starMatches.length);
    }
  }

  // 2. Check tags
  if (Array.isArray(tags)) {
    // Check for rating tag: ["rating", "5", "5"] or ["rating", "1.0"] or ["rating", "4.5"]
    const ratingTag = tags.find((t) => Array.isArray(t) && (t[0] === 'rating' || t[0] === 'rate' || t[0] === 'score'));
    if (ratingTag && ratingTag[1]) {
      const val = parseFloat(ratingTag[1]);
      if (!isNaN(val)) {
        if (ratingTag[2] && parseFloat(ratingTag[2]) > 0) {
          const max = parseFloat(ratingTag[2]);
          return (val / max) * 5;
        }
        // If 0 < val <= 1.0, it's normalized 0-1 scale (NIP-32) -> multiply by 5
        if (val > 0 && val <= 1.0) {
          return val * 5;
        }
        return val <= 5 ? val : (val / 10) * 5;
      }
    }

    // Check for NIP-32 label tag with rating e.g. ["l", "1.0", "rating"] or ["l", "4.5", "rating"] or ["L", "rating", "1.0"]
    const lTag = tags.find((t) => Array.isArray(t) && (t[0] === 'l' || t[0] === 'L') && t.some((part) => part.includes('rating') || part.includes('star')));
    if (lTag) {
      const numPart = lTag.find((part) => !isNaN(parseFloat(part)));
      if (numPart) {
        const val = parseFloat(numPart);
        if (val > 0 && val <= 1.0) {
          return val * 5;
        }
        return val <= 5 ? val : (val / 10) * 5;
      }
    }
  }

  return null;
}
