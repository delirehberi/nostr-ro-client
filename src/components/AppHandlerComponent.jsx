import React from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';

export function AppHandlerComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const appCtx = meta.appHandlerContext || {};
  const kindBadge = getKindLabel(event.kind);

  return (
    <>
      <div className="card-badge app-badge">{kindBadge}</div>

      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      <div className="app-card-body">
        {appCtx.picture && (
          <div className="app-logo-wrap">
            <img
              src={appCtx.picture}
              alt={appCtx.name}
              className="app-logo-img"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="app-info-wrap">
          <h3 className="app-title">{appCtx.name}</h3>
          {appCtx.nip05 && <div className="app-nip05-badge">✓ {appCtx.nip05}</div>}
          {appCtx.about && <p className="app-about">{appCtx.about}</p>}
        </div>
      </div>

      {appCtx.supportedKinds && appCtx.supportedKinds.length > 0 && (
        <div className="app-supported-kinds-row">
          <span className="app-kinds-label">Supported Events:</span>
          {appCtx.supportedKinds.map((k, idx) => (
            <span key={idx} className="app-kind-pill">
              Kind {k}
            </span>
          ))}
        </div>
      )}

      {/* Action Buttons: Website & NostrHub */}
      <div className="app-cta-row">
        {appCtx.website && (
          <a
            href={appCtx.website}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-app-primary"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Open Website ↗
          </a>
        )}

        {appCtx.nostrhubUrl && (
          <a
            href={appCtx.nostrhubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-nostrhub"
          >
            <span style={{ marginRight: '5px' }}>🚀</span>
            View on NostrHub ↗
          </a>
        )}
      </div>

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

export default AppHandlerComponent;
