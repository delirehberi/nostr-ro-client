import React, { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { shortifyNpub } from './ProfileAvatar.jsx';

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIDEO_REGEX = /\.(mp4|webm|ogg|mov)(?:\?[^#\s]*)?$/i;
const IMAGE_REGEX = /\.(jpe?g|png|gif|bmp|webp|svg|avif)(?:\?[^#\s]*)?$/i;
const NOSTR_MENTION_REGEX = /(?:nostr:)?\b((?:npub|note|nevent|nprofile|naddr|nrelay)1[0-9a-z]{20,})\b/g;

function VideoPlayer({ url }) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return <video src={url} controls autoPlay playsInline />;
  }

  return (
    <div className="video-container" onClick={() => setIsPlaying(true)}>
      <div className="play-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <span style={{ fontSize: '0.9em', marginTop: '0.5em', color: 'var(--meta)' }}>
        Play Video
      </span>
    </div>
  );
}

export function FormattedContent({ content, profileMap }) {
  if (!content) return null;

  // Split content by lines first
  const lines = content.split('\n');

  return (
    <div className="post-content">
      {lines.map((line, lineIndex) => {
        // Tokenize line by URLs
        const parts = line.split(URL_REGEX);
        return (
          <React.Fragment key={lineIndex}>
            {parts.map((part, partIndex) => {
              if (URL_REGEX.test(part)) {
                // Check YouTube
                const ytMatch = part.match(YOUTUBE_REGEX);
                if (ytMatch && ytMatch[1]) {
                  const videoId = ytMatch[1];
                  return (
                    <div key={partIndex} className="youtube-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        frameBorder="0"
                        allowFullScreen
                        loading="lazy"
                        title="YouTube video"
                      />
                    </div>
                  );
                }

                // Check Video
                if (VIDEO_REGEX.test(part)) {
                  return <VideoPlayer key={partIndex} url={part} />;
                }

                // Check Image
                if (IMAGE_REGEX.test(part)) {
                  return (
                    <div key={partIndex} className="post-image-wrapper">
                      <a href={part} target="_blank" rel="noopener noreferrer">
                        <img src={part} className="post-image" alt="Embedded Nostr Media" loading="lazy" />
                      </a>
                    </div>
                  );
                }

                // Standard external URL
                return (
                  <a
                    key={partIndex}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    {part}
                  </a>
                );
              }

              // Parse Nostr mentions within plain text segments
              return renderTextWithNostrMentions(part, profileMap, partIndex);
            })}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function renderTextWithNostrMentions(text, profileMap, keyPrefix) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  NOSTR_MENTION_REGEX.lastIndex = 0;
  while ((match = NOSTR_MENTION_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const bech32 = match[1];

    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    const short = shortifyNpub(bech32);
    let label = short;

    if (bech32.startsWith('npub1') || bech32.startsWith('nprofile1')) {
      try {
        const decoded = nip19.decode(bech32);
        let pubkey;
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else if (decoded.type === 'nprofile') {
          pubkey = decoded.data.pubkey;
        }
        if (pubkey && profileMap) {
          const profile = profileMap.get ? profileMap.get(pubkey) : profileMap[pubkey];
          if (profile && (profile.name || profile.display_name)) {
            label = profile.name || profile.display_name;
          }
        }
      } catch (_) {}

      parts.push(
        <a
          key={`nostr-${matchStart}`}
          href={`https://njump.me/${bech32}`}
          target="_blank"
          rel="noopener noreferrer"
          className="nostr-mention"
        >
          @{label}
        </a>
      );
    } else if (bech32.startsWith('note1') || bech32.startsWith('nevent1')) {
      parts.push(
        <a
          key={`nostr-${matchStart}`}
          href={`https://njump.me/${bech32}`}
          target="_blank"
          rel="noopener noreferrer"
          className="nostr-event-ref"
        >
          [event:{short}]
        </a>
      );
    } else {
      parts.push(
        <a
          key={`nostr-${matchStart}`}
          href={`https://njump.me/${bech32}`}
          target="_blank"
          rel="noopener noreferrer"
          className="nostr-addr-ref"
        >
          [nostr:{short}]
        </a>
      );
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <React.Fragment key={keyPrefix}>{parts}</React.Fragment>;
}

export default FormattedContent;
