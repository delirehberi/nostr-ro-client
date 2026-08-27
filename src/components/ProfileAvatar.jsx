import React from 'react';

export function shortifyNpub(npub) {
  if (!npub || typeof npub !== 'string') return npub || '';
  if (npub.length <= 16) return npub;
  return npub.slice(0, 8) + '...' + npub.slice(-4);
}

export function ProfileAvatar({ pubkey, profileMap }) {
  const profile = (profileMap && profileMap.get ? profileMap.get(pubkey) : profileMap?.[pubkey]) || {};
  const name = profile.display_name || profile.name || shortifyNpub(pubkey);
  const picture = profile.picture || `https://robohash.org/${pubkey}?set=set5`;

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
        {profile.nip05 && <span className="user-nip05">{profile.nip05}</span>}
      </div>
    </div>
  );
}

export default ProfileAvatar;
