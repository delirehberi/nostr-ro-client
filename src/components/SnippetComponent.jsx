import React, { useState } from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';

export function SnippetComponent({ event, profileMap }) {
  const [copied, setCopied] = useState(false);
  const meta = extractEventMetadata(event);
  const snippetCtx = meta.snippetContext || {};
  const kindBadge = getKindLabel(event.kind);

  const handleCopyCode = () => {
    if (navigator?.clipboard && event.content) {
      navigator.clipboard.writeText(event.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const title = snippetCtx.title || meta.title || meta.dTag || 'Code Snippet';
  const language = snippetCtx.language || 'code';

  return (
    <>
      <div className="card-badge snippet-badge">{kindBadge}</div>

      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      <div className="snippet-title-row">
        <h3 className="snippet-title">💻 {title}</h3>
        <span className="snippet-lang-pill">{language}</span>
      </div>

      {snippetCtx.description && (
        <p className="snippet-desc">{snippetCtx.description}</p>
      )}

      {event.content && (
        <div className="snippet-code-wrapper">
          <div className="snippet-code-header">
            <span className="snippet-code-filename">{title}</span>
            <button
              type="button"
              className="btn-snippet-copy"
              onClick={handleCopyCode}
              title="Copy code to clipboard"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="snippet-code-pre">
            <code>{event.content}</code>
          </pre>
        </div>
      )}

      {/* Direct link to snips.emre.xyz */}
      <div className="snippet-cta-row">
        <a
          href={snippetCtx.snipsUrl || `https://snips.emre.xyz/#/s/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-snips"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Open in Snips ↗
        </a>
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

export default SnippetComponent;
