import React from 'react';
import { nip19 } from 'nostr-tools';
import { extractEventMetadata, encodeNaddr } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { QuotedEventCard } from './QuotedEventCard.jsx';

export function ReactionComponent({ event, profileMap, eventMap }) {
  const meta = extractEventMetadata(event);
  const reactionCtx = meta.reactionContext || {};
  const targetId = reactionCtx.targetEventId;
  const targetCoord = reactionCtx.targetCoordinate;

  // Format the reaction symbol into a human friendly label
  let symbol = reactionCtx.reaction || '+';
  let reactionLabel = `Reacted "${symbol}"`;
  if (symbol === '+' || symbol === '❤️' || symbol === 'liked' || symbol === ':heart:') {
    symbol = '❤️';
    reactionLabel = 'Liked post';
  } else if (symbol === '🤙') {
    reactionLabel = 'Shaka 🤙';
  } else if (symbol === '⚡' || symbol === 'zap') {
    symbol = '⚡';
    reactionLabel = 'Zapped ⚡';
  } else if (symbol === '🔥') {
    symbol = '🔥';
    reactionLabel = 'Lit 🔥';
  } else if (symbol === '👍' || symbol === '+1') {
    symbol = '👍';
    reactionLabel = 'Thumbs up 👍';
  }

  // Check if reacting to a Git repository coordinate (e.g. 30617:pubkey:dTag)
  let repoTarget = null;
  if (targetCoord && targetCoord.startsWith('30617:')) {
    const parts = targetCoord.split(':');
    const repoPubkey = parts[1];
    const repoIdentifier = parts.slice(2).join(':');
    const repoNaddr = encodeNaddr(repoPubkey, 30617, repoIdentifier);
    repoTarget = {
      name: repoIdentifier || 'Repository',
      naddr: repoNaddr,
      url: repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}` : `https://njump.me/${targetCoord}`
    };
  }

  return (
    <>
      <div className="card-badge reaction-badge">
        <span className="reaction-badge-symbol">{symbol}</span>
        <span>{reactionLabel}</span>
      </div>

      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      {repoTarget ? (
        <div className="reaction-target-repo-box">
          <span className="reaction-target-repo-icon">💻</span>
          <span className="reaction-target-repo-label">Reacted to repository:</span>
          <a
            href={repoTarget.url}
            target="_blank"
            rel="noopener noreferrer"
            className="reaction-target-repo-link"
          >
            {repoTarget.name}
          </a>
        </div>
      ) : targetId ? (
        <div className="reaction-target-wrap">
          <QuotedEventCard
            quoteId={targetId}
            profileMap={profileMap}
            eventMap={eventMap}
          />
        </div>
      ) : targetCoord ? (
        <div className="reaction-target-repo-box">
          <span className="reaction-target-repo-icon">📍</span>
          <a
            href={`https://njump.me/${targetCoord}`}
            target="_blank"
            rel="noopener noreferrer"
            className="reaction-target-repo-link"
          >
            {targetCoord}
          </a>
        </div>
      ) : null}

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

export default ReactionComponent;
