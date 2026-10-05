import React from 'react';
import { extractEventMetadata } from '../kinds.js';
import { safeHttpUrl } from '../safeUrl.js';

export function HighlightComponent({ event }) {
  const meta = extractEventMetadata(event);
  const sourceUrl = meta.items?.find((i) => i.type === 'r' || i.type === 'a' || i.type === 'e');

  return (
    <>
      <div className="card-badge highlight-badge">💡 Highlight</div>
      <blockquote className="highlight-quote">&quot;{event.content}&quot;</blockquote>
      <div className="post-meta">
        <span>{new Date(event.created_at * 1000).toLocaleDateString()}</span>
        {sourceUrl && (
          <a
            href={safeHttpUrl(sourceUrl.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action"
          >
            Source ↗
          </a>
        )}
        <a
          href={`https://njump.me/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit' }}
        >
          relay link
        </a>
      </div>
    </>
  );
}

export default HighlightComponent;
