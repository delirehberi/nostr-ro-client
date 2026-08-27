import React from 'react';
import { extractEventMetadata } from '../kinds.js';
import { FormattedContent } from './FormattedContent.jsx';

export function MediaComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const isVideo = meta.subCategory === 'videos';

  return (
    <>
      <div className="card-badge media-badge">{isVideo ? '📹 Video' : '🖼️ Photo'}</div>
      <div className="media-container">
        <FormattedContent content={event.content} profileMap={profileMap} />
      </div>
      {meta.title && <h4 className="media-title">{meta.title}</h4>}
      <div className="post-meta">
        <span>{new Date(event.created_at * 1000).toLocaleString()}</span>
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

export default MediaComponent;
