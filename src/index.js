import { Hono } from 'hono';
import { renderHomePage, renderPostPage } from './views.js';
import { nip19 } from 'nostr-tools';

const app = new Hono();

// Middleware to handle environment variables if needed, 
// but in Cloudflare Workers, bindings are in c.env
// Hono automatically binds to c.env

// Helper to fetch events from a relay
async function fetchFromRelay(relayUrl, filter) {
  return new Promise((resolve) => {
    let ws = new WebSocket(relayUrl);
    let results = [];
    let timeout = setTimeout(() => {
      ws.close();
      resolve([]);
    }, 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", "worker", filter]));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data[0] === "EVENT") {
        results.push(data[2]);
      } else if (data[0] === "EOSE") {
        ws.close();
        clearTimeout(timeout);
        resolve(results);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      resolve([]);
    };
  });
}

// Helper to get pubkey from NIP-05 identifier
async function getPubkeyFromNip05(nip05, defaultPubkey) {
  const [username, domain] = nip05.split("@");
  if (!username || !domain) return defaultPubkey;
  try {
    const resp = await fetch(`https://${domain}/.well-known/nostr.json?name=${username}`);
    if (!resp.ok) return defaultPubkey;
    const data = await resp.json();
    return data.names && data.names[username] ? data.names[username] : defaultPubkey;
  } catch {
    return defaultPubkey;
  }
}

// Helper to extract mentioned pubkeys from content
function extractMentionedPubkeys(content) {
  const pubkeys = new Set();
  const bech32Regex = /\b(npub1[0-9a-z]{20,}|nprofile1[0-9a-z]{20,})\b/g;
  const matches = content.matchAll(bech32Regex);

  for (const match of matches) {
    try {
      const decoded = nip19.decode(match[1]);
      if (decoded.type === 'npub') {
        pubkeys.add(decoded.data);
      } else if (decoded.type === 'nprofile') {
        pubkeys.add(decoded.data.pubkey);
      }
    } catch (e) {
      // ignore invalid bech32
    }
  }

  return pubkeys;
}

app.get('/', async (c) => {
  const invalidate = new URL(c.req.url).searchParams.get('cache') === 'invalidate';

  if (!invalidate) {
    const cached = await c.env.CACHE.get('homepage');
    if (cached) {
      return c.html(cached, { headers: { 'Cache-Control': 'public, max-age=60' } });
    }
  }

  const HANDLE = c.env.HANDLE;
  const PUBKEY = c.env.PUBKEY;

  const relays = [
    "wss://relay.emre.xyz",
    "wss://relay.nostr.band",
    "wss://relay.damus.io",
    "wss://nostr-pub.wellorder.net"
  ];

  let pubkeyHex = PUBKEY;
  if (!pubkeyHex && HANDLE) {
    pubkeyHex = await getPubkeyFromNip05(HANDLE, PUBKEY);
  }

  if (!pubkeyHex) {
    return c.text('Could not resolve pubkey.', 404);
  }

  const filter = {
    kinds: [1],
    authors: [pubkeyHex],
    limit: 500 // Fixed limit
  };

  // Unified Data Object: Map<id, event>
  const eventMap = new Map();

  // 1. Fetch Main Events from all relays in parallel
  try {
    const fetchPromises = relays.map(async (relay) => {
      try {
        return await fetchFromRelay(relay, filter);
      } catch (e) {
        return [];
      }
    });
    const allRelaysEvents = await Promise.all(fetchPromises);
    allRelaysEvents.flat().forEach(e => {
      if (e && e.id) {
        eventMap.set(e.id, e);
      }
    });
  } catch (e) {
    // Ignore parallel fetch failures, try to proceed with whatever is in eventMap
  }

  // Sort main events by created_at descending
  const sortedAll = Array.from(eventMap.values()).sort((a, b) => b.created_at - a.created_at);

  // List of IDs to show on this page (all sorted events)
  const mainEventIds = sortedAll.map(e => e.id);

  // 2. Identify Missing Parents & Collect Authors
  const parentIdsToFetch = new Set();
  const authorsToFetch = new Set();

  // Add main event authors
  sortedAll.forEach(e => authorsToFetch.add(e.pubkey));

  sortedAll.forEach(e => {
    if (Array.isArray(e.tags)) {
      const eTags = e.tags.filter(tag => tag[0] === 'e' && tag[1] && tag[1] !== e.id);
      if (eTags.length > 0) {
        const parentId = eTags[eTags.length - 1][1];
        if (!eventMap.has(parentId)) {
          parentIdsToFetch.add(parentId);
        }
      }
    }
  });

  // 3. Fetch Missing Parents
  if (parentIdsToFetch.size > 0) {
    const parentFilter = {
      ids: Array.from(parentIdsToFetch)
    };

    try {
      const parentPromises = relays.map(async (relay) => {
        try {
          return await fetchFromRelay(relay, parentFilter);
        } catch (e) {
          return [];
        }
      });
      const allParentEvents = await Promise.all(parentPromises);
      allParentEvents.flat().forEach(p => {
        if (p && p.id) {
          eventMap.set(p.id, p);
          authorsToFetch.add(p.pubkey); // Add parent authors
        }
      });
    } catch (e) {
      // ignore
    }
  }

  // 4. Extract Mentioned Pubkeys from Content
  eventMap.forEach(event => {
    const mentionedPubkeys = extractMentionedPubkeys(event.content);
    mentionedPubkeys.forEach(pk => authorsToFetch.add(pk));
  });

  // 5. Fetch Profiles
  const profileMap = new Map(); // pubkey -> parsed content
  if (authorsToFetch.size > 0) {
    const profileFilter = {
      kinds: [0],
      authors: Array.from(authorsToFetch)
    };

    try {
      const profilePromises = relays.map(async (relay) => {
        try {
          return await fetchFromRelay(relay, profileFilter);
        } catch (e) {
          return [];
        }
      });
      const allProfiles = await Promise.all(profilePromises);
      const profileCreatedAtMap = new Map(); // pubkey -> created_at

      allProfiles.flat().forEach(p => {
        try {
          const content = JSON.parse(p.content);
          const existingCreatedAt = profileCreatedAtMap.get(p.pubkey) || 0;
          if (p.created_at > existingCreatedAt) {
            profileMap.set(p.pubkey, content);
            profileCreatedAtMap.set(p.pubkey, p.created_at);
          }
        } catch (e) {
          // ignore bad json
        }
      });
    } catch (e) {
      // ignore
    }
  }

  const htmlString = String(renderHomePage(mainEventIds, eventMap, profileMap));
  await c.env.CACHE.put('homepage', htmlString);
  return c.html(htmlString, { headers: { 'Cache-Control': 'public, max-age=60' } });
});

app.get('/p/:id', async (c) => {
  const id = c.req.param('id');
  const invalidate = new URL(c.req.url).searchParams.get('cache') === 'invalidate';

  // 1. Parse and decode ID to hex if it is in bech32 format
  let hexId = id;
  if (id.startsWith('note1') || id.startsWith('nevent1')) {
    try {
      const decoded = nip19.decode(id);
      if (decoded.type === 'note') {
        hexId = decoded.data;
      } else if (decoded.type === 'nevent') {
        hexId = decoded.data.id;
      }
    } catch (e) {
      return c.text('Invalid Nostr event ID encoding.', 400);
    }
  }

  // If it's still not a 64-char hex string, it might be invalid
  if (!/^[0-9a-fA-F]{64}$/.test(hexId)) {
    return c.text('Invalid Nostr event ID format. Must be hex or note1/nevent1 bech32.', 400);
  }

  const cacheKey = `post:${hexId}`;

  // 2. Check Cache
  if (!invalidate) {
    const cached = await c.env.CACHE.get(cacheKey);
    if (cached) {
      return c.html(cached, { headers: { 'Cache-Control': 'public, max-age=60' } });
    }
  }

  const relays = [
    "wss://relay.emre.xyz",
    "wss://relay.nostr.band",
    "wss://relay.damus.io",
    "wss://nostr-pub.wellorder.net"
  ];

  const filter = {
    ids: [hexId],
    kinds: [1]
  };

  const eventMap = new Map();

  // 3. Fetch Single Post from all relays in parallel
  try {
    const fetchPromises = relays.map(async (relay) => {
      try {
        return await fetchFromRelay(relay, filter);
      } catch (e) {
        return [];
      }
    });
    const allRelaysEvents = await Promise.all(fetchPromises);
    allRelaysEvents.flat().forEach(e => {
      if (e && e.id) {
        eventMap.set(e.id, e);
      }
    });
  } catch (e) {
    // ignore
  }

  const mainEvent = eventMap.get(hexId);
  if (!mainEvent) {
    return c.text('Post not found on configured relays.', 404);
  }

  // 4. Identify parent context
  const parentIdsToFetch = new Set();
  const authorsToFetch = new Set();

  authorsToFetch.add(mainEvent.pubkey);

  if (Array.isArray(mainEvent.tags)) {
    const eTags = mainEvent.tags.filter(tag => tag[0] === 'e' && tag[1] && tag[1] !== mainEvent.id);
    if (eTags.length > 0) {
      const parentId = eTags[eTags.length - 1][1];
      if (!eventMap.has(parentId)) {
        parentIdsToFetch.add(parentId);
      }
    }
  }

  // 5. Fetch Parent if missing
  if (parentIdsToFetch.size > 0) {
    const parentFilter = {
      ids: Array.from(parentIdsToFetch)
    };

    try {
      const parentPromises = relays.map(async (relay) => {
        try {
          return await fetchFromRelay(relay, parentFilter);
        } catch (e) {
          return [];
        }
      });
      const allParentEvents = await Promise.all(parentPromises);
      allParentEvents.flat().forEach(p => {
        if (p && p.id) {
          eventMap.set(p.id, p);
          authorsToFetch.add(p.pubkey);
        }
      });
    } catch (e) {
      // ignore
    }
  }

  // 6. Extract mentioned pubkeys
  eventMap.forEach(event => {
    const mentionedPubkeys = extractMentionedPubkeys(event.content);
    mentionedPubkeys.forEach(pk => authorsToFetch.add(pk));
  });

  // 7. Fetch Profiles in parallel
  const profileMap = new Map();
  if (authorsToFetch.size > 0) {
    const profileFilter = {
      kinds: [0],
      authors: Array.from(authorsToFetch)
    };

    try {
      const profilePromises = relays.map(async (relay) => {
        try {
          return await fetchFromRelay(relay, profileFilter);
        } catch (e) {
          return [];
        }
      });
      const allProfiles = await Promise.all(profilePromises);
      const profileCreatedAtMap = new Map();

      allProfiles.flat().forEach(p => {
        try {
          const content = JSON.parse(p.content);
          const existingCreatedAt = profileCreatedAtMap.get(p.pubkey) || 0;
          if (p.created_at > existingCreatedAt) {
            profileMap.set(p.pubkey, content);
            profileCreatedAtMap.set(p.pubkey, p.created_at);
          }
        } catch (e) {
          // ignore bad json
        }
      });
    } catch (e) {
      // ignore
    }
  }

  // 8. Render
  const htmlString = String(renderPostPage(hexId, eventMap, profileMap));
  await c.env.CACHE.put(cacheKey, htmlString);
  return c.html(htmlString, { headers: { 'Cache-Control': 'public, max-age=60' } });
});

export default {
  fetch: app.fetch,
  async scheduled(_event, env) {
    await env.CACHE.delete('homepage');
  }
};
