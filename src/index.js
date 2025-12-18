import { Hono } from 'hono';
import { renderHomePage } from './views.js';
import { nip19 } from 'nostr-tools';

const app = new Hono();

// Middleware to handle environment variables if needed, 
// but in Cloudflare Workers, bindings are in c.env
// Hono automatically binds to c.env

// Helper to fetch events from a relay
async function fetchFromRelay(relayUrl, filter) {
  return new Promise((resolve, reject) => {
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

  // Calculate time for filter
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30; // 30 days

  const filter = {
    kinds: [1],
    authors: [pubkeyHex],
    limit: 500, // Fixed limit
    since
  };

  // Unified Data Object: Map<id, event>
  const eventMap = new Map();

  // 1. Fetch Main Events
  let fetchedEvents = [];
  for (let relay of relays) {
    try {
      fetchedEvents = await fetchFromRelay(relay, filter);
      if (fetchedEvents && fetchedEvents.length > 0) break;
    } catch (e) {
      // ignore
    }
  }

  // Add main events to Map
  fetchedEvents.forEach(e => eventMap.set(e.id, e));

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

    for (let relay of relays) {
      try {
        const parentEvents = await fetchFromRelay(relay, parentFilter);
        if (parentEvents && parentEvents.length > 0) {
          parentEvents.forEach(p => {
            eventMap.set(p.id, p);
            authorsToFetch.add(p.pubkey); // Add parent authors
          });
          break;
        }
      } catch (e) {
        // ignore
      }
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

    for (let relay of relays) {
      try {
        const profiles = await fetchFromRelay(relay, profileFilter);
        if (profiles && profiles.length > 0) {
          profiles.forEach(p => {
            try {
              const content = JSON.parse(p.content);
              if (!profileMap.has(p.pubkey)) {
                profileMap.set(p.pubkey, content);
              }
            } catch (e) {
              // ignore bad json
            }
          });
          // Try to get as many as possible
          if (profileMap.size === authorsToFetch.size) break;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  return c.html(renderHomePage(mainEventIds, eventMap, profileMap), {
    headers: {
      'Cache-Control': 'public, max-age=60'
    }
  });
});

export default app;
