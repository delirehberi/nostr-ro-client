import React from 'react';
import { nip19 } from 'nostr-tools';
import { extractEventMetadata } from '../kinds.js';
import { ProfileAvatar, shortifyNpub } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';
import { QuotedEventCard } from './QuotedEventCard.jsx';

export function SimpleTextPostComponent({ event, profileMap, eventMap }) {
  if (!event) return null;

  const isRepostKind = event.kind === 6 || event.kind === 16;
  let targetEvent = null;
  let isRepost = false;
  let reposterPubkey = null;

  if (isRepostKind) {
    isRepost = true;
    reposterPubkey = event.pubkey;

    // Try parsing target event from content
    if (event.content && typeof event.content === 'string' && event.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(event.content);
        if (parsed && (parsed.id || parsed.content)) {
          targetEvent = parsed;
        }
      } catch (_) {}
    }

    // If not in content, look for referenced 'e' tag in eventMap
    if (!targetEvent && Array.isArray(event.tags)) {
      const eTag = event.tags.find((t) => t[0] === 'e' && t[1]);
      if (eTag && eventMap) {
        targetEvent = eventMap.get ? eventMap.get(eTag[1]) : eventMap[eTag[1]];
      }
    }
  }

  // The actual event whose author and content should be displayed
  const displayEvent = targetEvent || event;
  const meta = extractEventMetadata(displayEvent);

  let noteId = displayEvent.id || event.id;
  try {
    noteId = nip19.noteEncode(noteId);
  } catch (_) {}

  // Find parent post if replying (only for original/display event)
  let parentBlock = null;
  if (Array.isArray(displayEvent.tags)) {
    const eTags = displayEvent.tags.filter(
      (tag) => tag[0] === 'e' && tag[1] && tag[1] !== displayEvent.id
    );
    if (eTags.length > 0) {
      const parentId = eTags[eTags.length - 1][1];
      const parentEvent = eventMap ? (eventMap.get ? eventMap.get(parentId) : eventMap[parentId]) : null;

      if (parentEvent) {
        parentBlock = (
          <div className="parent-post">
            <ProfileAvatar pubkey={parentEvent.pubkey} profileMap={profileMap} />
            <FormattedContent content={parentEvent.content} profileMap={profileMap} />
            <div className="post-meta" style={{ fontSize: '0.8em' }}>
              <a
                href={`https://njump.me/${parentEvent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit' }}
              >
                view original thread
              </a>
            </div>
          </div>
        );
      } else {
        parentBlock = (
          <div className="parent-link">
            <a
              href={`https://njump.me/${parentId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Replying to event: {parentId.slice(0, 8)}...{parentId.slice(-4)}
            </a>
          </div>
        );
      }
    }
  }

  // Reposter Name resolution
  let reposterName = '';
  if (isRepost && reposterPubkey) {
    const reposterProfile = (profileMap && profileMap.get ? profileMap.get(reposterPubkey) : profileMap?.[reposterPubkey]) || {};
    reposterName = reposterProfile.display_name || reposterProfile.name || shortifyNpub(reposterPubkey);
  }

  // Clean content of trailing or standalone quote links if quotes are rendered below
  let cleanContent = displayEvent.content || '';
  if (meta.quotes && meta.quotes.length > 0) {
    cleanContent = cleanContent
      .replace(/(?:^|\n)\s*(?:\[event:(?:nevent|note)1[0-9a-z]+\]|nostr:(?:nevent|note)1[0-9a-z]+)\s*(?=\n|$)/gi, '\n')
      .trim();
  }

  return (
    <>
      {isRepost && (
        <div className="card-badge repost-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 7a1 1 0 0 0-1-1h-8v2h7v5h-2l3 4 3-4h-2V7zM5 17a1 1 0 0 0 1 1h8v-2H7v-5h2L6 7 3 11h2v6z" />
          </svg>
          <span>Reposted by @{reposterName}</span>
        </div>
      )}

      {meta.repoContext && (
        <div className="repo-context-banner">
          <span className="repo-context-icon">💻</span>
          <span className="repo-context-label">Commented on repository:</span>
          <a
            href={meta.repoContext.url || `https://njump.me/${meta.repoContext.coordinate || meta.repoContext.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="repo-context-link"
          >
            {meta.repoContext.title || meta.repoContext.name}
          </a>
        </div>
      )}

      {parentBlock}

      <div className="post-header">
        <ProfileAvatar pubkey={displayEvent.pubkey} profileMap={profileMap} />
      </div>

      <FormattedContent content={cleanContent} profileMap={profileMap} />

      {meta.quotes && meta.quotes.length > 0 && (
        <div className="note-quotes-section">
          {meta.quotes.map((q, idx) => (
            <QuotedEventCard
              key={idx}
              quoteId={q.id}
              quoteBech32={q.bech32}
              profileMap={profileMap}
              eventMap={eventMap}
            />
          ))}
        </div>
      )}

      <div className="post-meta">
        <span>
          {displayEvent.created_at
            ? new Date(displayEvent.created_at * 1000).toLocaleString()
            : new Date(event.created_at * 1000).toLocaleString()}
        </span>
        <a href={`/p/${noteId}`} style={{ color: 'inherit' }}>
          share
        </a>
        <a
          href={`https://njump.me/${displayEvent.id || event.id}`}
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

export default SimpleTextPostComponent;
