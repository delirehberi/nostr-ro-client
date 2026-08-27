import React from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';

export function GenericComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const friendlyLabel = getKindLabel(event.kind);

  // Extract non-standard useful tags if items is empty
  const tags = event.tags || [];
  const displayTags = meta.items && meta.items.length > 0
    ? meta.items
    : tags
        .filter((t) => Array.isArray(t) && t[0] && t[1] && t[0] !== 'p' && t[0] !== 'e')
        .slice(0, 10)
        .map((t) => ({ type: t[0], value: t[1], title: t[2] || null }));

  return (
    <>
      <div className="card-badge other-badge">{friendlyLabel}</div>
      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      {(meta.title || meta.dTag) && (
        <h3 className="list-title" style={{ marginTop: '0.4em', marginBottom: '0.2em' }}>
          {meta.title || meta.dTag}
        </h3>
      )}

      {meta.summary && <p className="list-desc">{meta.summary}</p>}

      {event.content && (
        <div style={{ marginTop: '0.4em' }}>
          <FormattedContent content={event.content} profileMap={profileMap} />
        </div>
      )}

      {displayTags.length > 0 && (
        <div className="list-items-full-wrap" style={{ marginTop: '0.5em' }}>
          {displayTags.map((t, idx) => {
            if (t.type === 'server' || t.type === 'web' || t.type === 'clone') {
              return (
                <div key={idx} className="list-item-row">
                  <a
                    href={t.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="list-item-link"
                  >
                    {t.type === 'server' ? '🌸 ' : '💻 '}
                    {t.value}
                  </a>
                </div>
              );
            }
            if (t.type === 'r') {
              const isRelay = t.value.startsWith('wss://') || t.value.startsWith('ws://');
              return (
                <div key={idx} className="list-item-row">
                  <a
                    href={isRelay ? `https://nostr.watch/relay/${encodeURIComponent(t.value.replace(/^wss?:\/\//, ''))}` : t.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="list-item-link"
                  >
                    {isRelay ? '📡 ' : '🔗 '}
                    {t.title || t.value}
                  </a>
                </div>
              );
            }
            if (t.type === 't') {
              return (
                <span key={idx} className="list-item-pill tag-pill">
                  #{t.value}
                </span>
              );
            }
            return (
              <span key={idx} className="list-item-pill">
                <strong>{t.type}:</strong> {t.value}
              </span>
            );
          })}
        </div>
      )}

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

export default GenericComponent;
