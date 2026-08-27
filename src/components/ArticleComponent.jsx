import React from 'react';
import { extractEventMetadata, OWNER_PUBKEY } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';

export function ArticleComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event, 'https://blog.emre.xyz');
  const isOwner = event.pubkey === OWNER_PUBKEY;

  return (
    <>
      <div
        className="card-badge article-badge"
        style={
          !isOwner
            ? { background: 'var(--pill-bg)', color: 'var(--meta)' }
            : undefined
        }
      >
        {isOwner ? '✍️ Long-form Article' : '❤️ Liked Article'}
      </div>

      {!isOwner && (
        <div className="post-header" style={{ marginBottom: '0.6em' }}>
          <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
        </div>
      )}

      {meta.image && (
        <div className="article-banner">
          <img src={meta.image} alt={meta.title || 'Article Header'} loading="lazy" />
        </div>
      )}

      <h2 className="article-title">{meta.title || 'Untitled Article'}</h2>
      {meta.summary && <div className="article-summary">{meta.summary}</div>}

      <div className="article-cta-box">
        {isOwner ? (
          <a
            href={meta.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-blog-read"
          >
            Read Full Article on blog.emre.xyz →
          </a>
        ) : (
          <a
            href={meta.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action"
            style={{ padding: '6px 14px', fontSize: '0.9rem', fontWeight: 600 }}
          >
            Read Liked Article ↗
          </a>
        )}
      </div>

      <div className="post-meta">
        <span>Published: {new Date(event.created_at * 1000).toLocaleDateString()}</span>
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

export default ArticleComponent;
