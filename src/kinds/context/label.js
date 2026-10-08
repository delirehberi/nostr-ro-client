import { getAllTagValues } from '../tags.js';

/** NIP-32 label/review context, or null. */
export function buildLabelContext(event, ctx) {
  const { tags } = ctx;
  // Label & Review Context (Kind 1985 / 31985 / NIP-32)
  const isLabelOrReview = event.kind === 1985 || event.kind === 31985 || tags.some((t) => Array.isArray(t) && (t[0] === 'L' || t[0] === 'l'));
  let labelContext = null;
  if (isLabelOrReview) {
    const namespaces = getAllTagValues(tags, 'L');
    const labelTags = tags
      .filter((t) => Array.isArray(t) && t[0] === 'l' && t[1])
      .map((t) => ({ value: t[1], namespace: t[2] || (namespaces[0] || null) }));

    let target = null;
    const iTag = tags.find((t) => Array.isArray(t) && t[0] === 'i' && t[1]);
    const rTag = tags.find((t) => Array.isArray(t) && t[0] === 'r' && t[1]);
    const eTag = tags.find((t) => Array.isArray(t) && t[0] === 'e' && t[1]);
    const pTag = tags.find((t) => Array.isArray(t) && t[0] === 'p' && t[1]);
    const aTag = tags.find((t) => Array.isArray(t) && t[0] === 'a' && t[1]);

    const targetUrl = (iTag && iTag[1].startsWith('http')) ? iTag[1] : (rTag && rTag[1].startsWith('http')) ? rTag[1] : null;
    if (targetUrl) {
      const ghMatch = targetUrl.match(/github\.com\/([^/]+\/[^/]+)(?:\/(?:blob|tree|issues|pull)\/[^/]+\/(.+)|(?:\/(?:blob|tree|issues|pull)\/(.+)))?/i);
      if (ghMatch) {
        const repo = ghMatch[1];
        const filePath = ghMatch[2] || ghMatch[3] || '';
        const fileName = filePath ? filePath.split('/').pop() : '';
        target = {
          type: 'github',
          url: targetUrl,
          repo,
          path: filePath,
          fileName,
          title: fileName ? `${repo}: ${fileName}` : repo
        };
      } else {
        target = {
          type: 'url',
          url: targetUrl,
          title: targetUrl.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '')
        };
      }
    } else if (iTag) {
      target = { type: 'identifier', value: iTag[1], title: iTag[2] || iTag[1] };
    } else if (eTag) {
      target = { type: 'event', eventId: eTag[1] };
    } else if (pTag) {
      target = { type: 'profile', pubkey: pTag[1] };
    } else if (aTag) {
      target = { type: 'coordinate', coordinate: aTag[1] };
    }

    labelContext = {
      isLabelOrReview: true,
      namespaces,
      labels: labelTags,
      target
    };
  }
  return labelContext;
}
