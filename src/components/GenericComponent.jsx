import React from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar, shortifyNpub } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';
import { RatingStars } from './RatingStars.jsx';

export function GenericComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const friendlyLabel = getKindLabel(event.kind);

  // 1. App Data Cards (Kind 30078 / NIP-78)
  if (meta.appContext?.isAppData) {
    return (
      <>
        <div className="card-badge app-badge">{friendlyLabel}</div>
        <div className="post-header">
          <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
        </div>

        <h3 className="list-title" style={{ marginTop: '0.4em', marginBottom: '0.2em' }}>
          {meta.title || meta.dTag || `${meta.appContext.appName} Data`}
        </h3>

        <p className="app-data-desc">
          ⚙️ Application configuration & state update for <strong>{meta.appContext.appName}</strong> (NIP-78).
        </p>

        {event.content && (
          meta.appContext.isEncryptedOrRaw ? (
            <details className="app-data-details">
              <summary className="app-data-summary">
                <span>🔒 Encrypted / Serialized Payload ({event.content.length} chars)</span>
              </summary>
              <pre className="app-data-raw">{event.content}</pre>
            </details>
          ) : (
            <div style={{ marginTop: '0.4em' }}>
              <FormattedContent content={event.content} profileMap={profileMap} />
            </div>
          )
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

  // 2. Label & Review Cards (Kind 1985 / 31985 / NIP-32)
  if (meta.labelContext?.isLabelOrReview) {
    const { target, labels, namespaces } = meta.labelContext;

    return (
      <>
        <div className="card-badge review-badge">{friendlyLabel}</div>
        <div className="post-header">
          <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
        </div>

        {meta.rating !== null && (
          <div style={{ margin: '0.3em 0' }}>
            <RatingStars rating={meta.rating} />
          </div>
        )}

        {target && (
          <div className="review-target-box">
            <span className="review-target-label">Reviewing / Labeled:</span>
            {target.type === 'github' && (
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className="review-target-link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <strong>{target.repo}</strong>
                {target.path ? `: ${target.path}` : ''}
              </a>
            )}
            {target.type === 'url' && (
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className="review-target-link"
              >
                🔗 {target.title}
              </a>
            )}
            {target.type === 'event' && (
              <a
                href={`https://njump.me/${target.eventId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="review-target-link"
              >
                📝 Event: {target.eventId.slice(0, 10)}...
              </a>
            )}
            {target.type === 'profile' && (
              <a
                href={`https://njump.me/${target.pubkey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="review-target-link"
              >
                👤 User: {shortifyNpub(target.pubkey)}
              </a>
            )}
            {target.type === 'coordinate' && (
              <span className="review-target-link">
                📍 {target.coordinate}
              </span>
            )}
            {target.type === 'identifier' && (
              <span className="review-target-link">
                🏷️ {target.title}
              </span>
            )}
          </div>
        )}

        {(labels.length > 0 || namespaces.length > 0) && (
          <div className="review-badges-row">
            {namespaces.map((ns, idx) => (
              <span key={`ns-${idx}`} className="review-tag-badge ns-badge">
                📁 {ns}
              </span>
            ))}
            {labels.map((l, idx) => (
              <span key={`l-${idx}`} className="review-tag-badge">
                🏷️ {l.value}
              </span>
            ))}
          </div>
        )}

        {event.content && (
          <div style={{ marginTop: '0.5em' }}>
            <FormattedContent content={event.content} profileMap={profileMap} />
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

  // 3. Fallback generic events
  const tags = event.tags || [];
  const displayTags = meta.items && meta.items.length > 0
    ? meta.items.filter((i) => i.type !== 'p')
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
            if (t.type === 'r' || (t.type === 'i' && typeof t.value === 'string' && t.value.startsWith('http'))) {
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
