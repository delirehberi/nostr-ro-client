import React from 'react';
import { extractEventMetadata, getKindLabel, encodeNaddr, encodeNpub } from '../kinds.js';
import { ProfileAvatar, shortifyNpub } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';

export function ListComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const listBadge = getKindLabel(event.kind);

  const items = meta.items || [];
  const pItems = items.filter((i) => i.type === 'p');
  const otherItems = items.filter((i) => i.type !== 'p');
  const isGitFollowList = event.kind === 10017;
  const isPeopleList =
    event.kind === 3 ||
    event.kind === 30000 ||
    event.kind === 10000 ||
    event.kind === 10017 ||
    (pItems.length > 0 && otherItems.length === 0);

  // Take first 3 for avatar stack
  const previewPItems = pItems.slice(0, 3);
  const remainingCount = pItems.length - 3;

  const defaultTitle = isGitFollowList
    ? 'Git Follow List'
    : isPeopleList
    ? 'Follow List'
    : listBadge.replace(/^[^a-zA-Z0-9]+/, '').trim();

  return (
    <>
      <div className={`card-badge ${isGitFollowList ? 'git-badge' : 'list-badge'}`}>{listBadge}</div>
      <div className="post-header">
        <ProfileAvatar pubkey={event.pubkey} profileMap={profileMap} />
      </div>

      <h3 className="list-title">
        {meta.title || meta.dTag || defaultTitle}
      </h3>
      {meta.summary && <p className="list-desc">{meta.summary}</p>}

      {isPeopleList && pItems.length > 0 && (
        <div className="follow-list-container">
          <div className="follow-list-header">
            <span className="follow-count-label">
              {isGitFollowList ? '💻' : '👥'} <strong>{pItems.length}</strong> {isGitFollowList ? 'developers / contributors' : (pItems.length === 1 ? 'account' : 'accounts')} followed
            </span>
          </div>

          <div className="follow-avatar-stack">
            {previewPItems.map((item, idx) => {
              const pInfo = profileMap
                ? profileMap.get
                  ? profileMap.get(item.value)
                  : profileMap[item.value]
                : null;
              const name = pInfo ? pInfo.name || pInfo.display_name : shortifyNpub(item.value);
              const pic = pInfo?.picture || `https://robohash.org/${item.value}?set=set5`;
              const profileUrl = isGitFollowList
                ? `https://gitworkshop.dev/${encodeNpub(item.value)}`
                : `https://njump.me/${item.value}`;

              return (
                <a
                  key={idx}
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="avatar-stack-link"
                  title={`@${name}${isGitFollowList ? ' (GitWorkshop)' : ''}`}
                >
                  <img
                    src={pic}
                    className="avatar-stack-img"
                    alt={name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = `https://robohash.org/${item.value}?set=set5`;
                    }}
                  />
                </a>
              );
            })}

            {remainingCount > 0 && (
              <a
                href={`https://njump.me/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="avatar-stack-ellipsis"
                title={`View all ${pItems.length} users`}
              >
                +{remainingCount}
              </a>
            )}
          </div>
        </div>
      )}

      {otherItems.length > 0 && (
        <>
          <div className="list-section-title">Items ({otherItems.length}):</div>
          <div className="list-items-full-wrap">
            {otherItems.map((item, idx) => {
              if (item.type === 'server') {
                return (
                  <div key={idx} className="list-item-row">
                    <a
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-link"
                    >
                      🌸 {item.value}
                    </a>
                  </div>
                );
              }

              if (item.type === 't') {
                return (
                  <span key={idx} className="list-item-pill tag-pill">
                    #{item.value}
                  </span>
                );
              }

              if (item.type === 'r') {
                const isRelay = item.value.startsWith('wss://') || item.value.startsWith('ws://');
                return (
                  <div key={idx} className="list-item-row">
                    <a
                      href={isRelay ? `https://nostr.watch/relay/${encodeURIComponent(item.value.replace(/^wss?:\/\//, ''))}` : item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-link"
                    >
                      {isRelay ? '📡 ' : '🔗 '} {item.title || item.value}
                    </a>
                  </div>
                );
              }

              if (item.type === 'a' && item.value.startsWith('30617:')) {
                const parts = item.value.split(':');
                const repoPubkey = parts[1];
                const repoIdentifier = parts.slice(2).join(':');
                const repoNaddr = encodeNaddr(repoPubkey, 30617, repoIdentifier);
                const repoUrl = repoNaddr ? `https://gitworkshop.dev/r/${repoNaddr}` : `https://gitworkshop.dev/${encodeNpub(repoPubkey)}/${repoIdentifier}`;
                return (
                  <div key={idx} className="list-item-row">
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-link"
                    >
                      💻 <strong>{repoIdentifier || item.title || 'Git Repository'}</strong>
                    </a>
                  </div>
                );
              }

              if (item.type === 'clone' || item.type === 'web') {
                return (
                  <div key={idx} className="list-item-row">
                    <a
                      href={item.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-link"
                    >
                      💻 {item.value}
                    </a>
                  </div>
                );
              }

              if (item.type === 'e') {
                return (
                  <div key={idx} className="list-item-row">
                    <a
                      href={`https://njump.me/${item.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-link"
                    >
                      📝 Note: {item.value.slice(0, 10)}...
                    </a>
                  </div>
                );
              }

              return (
                <span key={idx} className="list-item-pill">
                  {item.title || item.value}
                </span>
              );
            })}
          </div>
        </>
      )}

      {event.content && (
        <FormattedContent content={event.content} profileMap={profileMap} />
      )}

      <div className="post-meta">
        <span>
          {items.length > 0 ? `${items.length} items • ` : ''}
          {new Date(event.created_at * 1000).toLocaleDateString()}
        </span>
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

export default ListComponent;
