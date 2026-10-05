import React from 'react';
import { extractEventMetadata } from '../kinds.js';
import { safeHttpUrl } from '../safeUrl.js';
import { FormattedContent, VideoPlayer } from './FormattedContent.jsx';

/** Image or video attached via an `imeta` / NIP-94 `url` tag. */
function MediaItem({ item }) {
  const url = safeHttpUrl(item.url);
  if (!url) return null;
  if (item.type === 'video') return <VideoPlayer url={url} />;
  return (
    <div className="post-image-wrapper">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} className="post-image" alt={item.alt || 'Attached image'} loading="lazy" />
      </a>
    </div>
  );
}

export function MediaComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const isVideo = meta.subCategory === 'videos';
  const content = event.content || '';
  // FormattedContent already embeds URLs that appear in the text.
  const attached = (meta.media || []).filter((item) => !content.includes(item.url));
  // For kind 1063 the content is the file description, used as the image alt text.
  const caption = event.kind === 1063 && attached.length > 0 ? '' : content;

  return (
    <>
      <div className="card-badge media-badge">{isVideo ? '📹 Video' : '🖼️ Photo'}</div>
      <div className="media-container">
        {attached.map((item) => (
          <MediaItem key={item.url} item={item} />
        ))}
        <FormattedContent content={caption} profileMap={profileMap} />
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
