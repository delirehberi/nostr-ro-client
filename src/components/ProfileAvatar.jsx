import React from 'react';
import { safeHttpUrl } from '../safeUrl.js';
import { useNip05 } from '../hooks/useNip05.js';

export function shortifyNpub(npub) {
  if (!npub || typeof npub !== 'string') return npub || '';
  if (npub.length <= 16) return npub;
  return npub.slice(0, 8) + '...' + npub.slice(-4);
}

export function ProfileAvatar({ pubkey, profileMap }) {
  const profile = (profileMap && profileMap.get ? profileMap.get(pubkey) : profileMap?.[pubkey]) || {};
  const nip05Verified = useNip05(profile.nip05, pubkey);
  const name = profile.display_name || profile.name || shortifyNpub(pubkey);
  const picture = safeHttpUrl(profile.picture) || `https://robohash.org/${pubkey}?set=set5`;

  return (
    <div className="user-info">
      <img
        src={picture}
        alt={name}
        className="user-avatar"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = `https://robohash.org/${pubkey}?set=set5`;
        }}
      />
      <div className="user-meta">
        <span className="user-name">{name}</span>
        {nip05Verified && <span className="user-nip05">✓ {profile.nip05}</span>}
      </div>
    </div>
  );
}

export default ProfileAvatar;
