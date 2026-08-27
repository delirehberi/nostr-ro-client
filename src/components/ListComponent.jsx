import React from 'react';
import { extractEventMetadata, getKindLabel } from '../kinds.js';
import { shortifyNpub } from './ProfileAvatar.jsx';
import { FormattedContent } from './FormattedContent.jsx';

export function ListComponent({ event, profileMap }) {
  const meta = extractEventMetadata(event);
  const listBadge = getKindLabel(event.kind);

  return (
    <>
      <div className="card-badge list-badge">{listBadge}</div>
      <h3 className="list-title">
        {meta.title || meta.dTag || listBadge.replace(/^[^a-zA-Z0-9]+/, '').trim()}
      </h3>
      {meta.summary && <p className="list-desc">{meta.summary}</p>}

      {meta.items && meta.items.length > 0 && (
        <>
          <div className="list-section-title">Items ({meta.items.length}):</div>
          <div className="list-items-full-wrap">
            {meta.items.map((item, idx) => {
              if (item.type === 'p') {
                const pInfo = profileMap
                  ? profileMap.get
                    ? profileMap.get(item.value)
                    : profileMap[item.value]
                  : null;
                const name = pInfo ? pInfo.name || pInfo.display_name : shortifyNpub(item.value);
                const pic = pInfo?.picture || `https://robohash.org/${item.value}?set=set5`;

                return (
                  <div key={idx} className="list-item-row">
                    <img
                      src={pic}
                      className="list-item-avatar"
                      alt={name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = `https://robohash.org/${item.value}?set=set5`;
                      }}
                    />
                    <a
                      href={`https://njump.me/${item.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="list-item-name"
                    >
                      @{name}
                    </a>
                  </div>
                );
              }

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
          {meta.items && meta.items.length > 0 ? `${meta.items.length} items • ` : ''}
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
