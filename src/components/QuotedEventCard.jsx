import React from 'react';
import { nip19 } from 'nostr-tools';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';

export function QuotedEventCard({ quoteId, quoteBech32, profileMap, eventMap }) {
  let targetId = quoteId;

  if (!targetId && quoteBech32) {
    try {
      const decoded = nip19.decode(quoteBech32);
      if (decoded.type === 'note') targetId = decoded.data;
      else if (decoded.type === 'nevent') targetId = decoded.data.id;
    } catch (_) {}
  }

  const targetEvent = eventMap && targetId
    ? (eventMap.get ? eventMap.get(targetId) : eventMap[targetId])
    : null;

  let bech32Id = quoteBech32;
  if (!bech32Id && targetId) {
    try {
      bech32Id = nip19.noteEncode(targetId);
    } catch (_) {
      bech32Id = targetId;
    }
  }

  if (!targetEvent) {
    return (
      <div className="quoted-event-card quoted-placeholder">
        <span className="quoted-icon">💬</span>
        <span className="quoted-placeholder-text">Quoted Event:</span>
        <a
          href={`https://njump.me/${bech32Id || targetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="quoted-placeholder-link"
        >
          {bech32Id ? `${bech32Id.slice(0, 12)}...${bech32Id.slice(-6)}` : targetId}
        </a>
      </div>
    );
  }

  const meta = extractEventMetadata(targetEvent);
  const kindBadge = getKindLabel(targetEvent.kind);

  return (
    <div className="quoted-event-card">
      <div className="quoted-event-header">
        <div className="quoted-author-box">
          <ProfileAvatar pubkey={targetEvent.pubkey} profileMap={profileMap} />
        </div>
        <div className="quoted-header-meta">
          <span className="quoted-badge">{kindBadge}</span>
          <span className="quoted-time">
            {new Date(targetEvent.created_at * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>

      {meta.gitContext && (
        <div className="quoted-git-banner">
          <span>💻 <strong>{meta.gitContext.repoName}</strong>: {meta.gitContext.subject}</span>
        </div>
      )}

      {targetEvent.content && (
        <div className="quoted-event-content">
          <FormattedContent content={targetEvent.content} profileMap={profileMap} />
        </div>
      )}

      <div className="quoted-event-footer">
        <a
          href={`/p/${bech32Id}`}
          className="quoted-footer-link"
        >
          view quote
        </a>
        <a
          href={meta.gitContext?.gitworkshopUrl || `https://njump.me/${targetEvent.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="quoted-footer-link"
        >
          {meta.gitContext ? 'gitworkshop link' : 'relay link'}
        </a>
      </div>
    </div>
  );
}

export default QuotedEventCard;
