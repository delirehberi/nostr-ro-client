import React, { useState } from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';
import { QuotedEventCard } from './QuotedEventCard.jsx';

export function GitEventComponent({ event, profileMap, eventMap }) {
  const [copiedClone, setCopiedClone] = useState(false);
  const meta = extractEventMetadata(event);
  const gitCtx = meta.gitContext || {};
  const kindBadge = getKindLabel(event.kind);

  const handleCopyClone = (url) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(`git clone ${url}`);
      setCopiedClone(true);
      setTimeout(() => setCopiedClone(false), 2000);
    }
  };

  const isRepoAnnouncement = event.kind === 30617;
  const isRepoState = event.kind === 30618;
  const isPullRequest = event.kind === 1618;
  const isIssue = event.kind === 1621;
  const isPatch = event.kind === 1617;

  return (
    <>
      <div className="card-badge git-badge">{kindBadge}</div>

      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      {/* Repo Context Banner */}
      {gitCtx.repoName && (
        <div className="git-repo-banner">
          <span className="git-banner-icon">💻</span>
          <span className="git-banner-label">Repository:</span>
          <a
            href={gitCtx.gitworkshopRepoUrl || gitCtx.gitworkshopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="git-banner-link"
          >
            <strong>{gitCtx.repoName}</strong>
          </a>
          {gitCtx.branch && (
            <span className="git-branch-pill">
              🌿 {gitCtx.branch}
            </span>
          )}
        </div>
      )}

      {/* PR / Issue / Repo Title */}
      {(gitCtx.subject || meta.title || meta.dTag) && (
        <h3 className="git-event-title">
          {gitCtx.subject || meta.title || meta.dTag}
        </h3>
      )}

      {/* Repo Description */}
      {meta.summary && <p className="git-event-summary">{meta.summary}</p>}

      {/* Main Content */}
      {event.content && !isRepoState && (
        <div className="git-event-content">
          <FormattedContent content={event.content} profileMap={profileMap} />
        </div>
      )}

      {/* Commit Badges */}
      {gitCtx.commitBadges && gitCtx.commitBadges.length > 0 && (
        <div className="git-commits-row">
          <span className="git-commits-label">Commits:</span>
          {gitCtx.commitBadges.map((cb, idx) => (
            <a
              key={idx}
              href={cb.url}
              target="_blank"
              rel="noopener noreferrer"
              className="git-commit-pill"
              title={`View commit ${cb.hash} on GitWorkshop`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.1c2.83-.48 5-2.94 5-5.9 0-3.31-2.69-6-6-6s-6 2.69-6 6c0 2.96 2.17 5.42 5 5.9v2.1c-4.52-.52-8-4.35-8-9 0-4.97 4.03-9 9-9s9 4.03 9 9c0 4.65-3.48 8.48-8 9z"/>
              </svg>
              {cb.shortHash}
            </a>
          ))}
        </div>
      )}

      {/* Clone URLs for Repositories */}
      {isRepoAnnouncement && gitCtx.cloneUrls && gitCtx.cloneUrls.length > 0 && (
        <div className="git-clone-box">
          <span className="git-clone-label">Clone Repository:</span>
          {gitCtx.cloneUrls.map((url, idx) => (
            <div key={idx} className="git-clone-row">
              <code className="git-clone-code">git clone {url}</code>
              <button
                type="button"
                className="btn-git-copy"
                onClick={() => handleCopyClone(url)}
                title="Copy clone command"
              >
                {copiedClone ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quoted / Embedded Events if any */}
      {meta.quotes && meta.quotes.length > 0 && (
        <div className="git-quotes-section">
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

      {/* CTA Button to GitWorkshop */}
      {gitCtx.gitworkshopUrl && (
        <div className="git-cta-row">
          <a
            href={gitCtx.gitworkshopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gitworkshop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            <span>
              {isPullRequest ? 'View PR on GitWorkshop ↗' : isIssue ? 'View Issue on GitWorkshop ↗' : isRepoAnnouncement ? 'Open Repo in GitWorkshop ↗' : 'Open in GitWorkshop ↗'}
            </span>
          </a>
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

export default GitEventComponent;
