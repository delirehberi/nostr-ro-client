export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = 250;
    const HANDLE = env.HANDLE; 
    const PUBKEY = env.PUBKEY; 

    // Nostr relay endpoints (public relays, can be adjusted)
    const relays = [
      "wss://relay.nostr.band",
      "wss://relay.damus.io",
      "wss://nostr-pub.wellorder.net"
    ];

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
    async function getPubkeyFromNip05(nip05) {
      // NIP-05: username@domain
      const [username, domain] = nip05.split("@");
      if (!username || !domain) return null;
      try {
        console.dir(`https://${domain}/.well-known/nostr.json?name=${username}`)
        const resp = await fetch(`https://${domain}/.well-known/nostr.json?name=${username}`);
        if (!resp.ok) return PUBKEY;
        const data = await resp.json(); 
        return data.names && data.names[username] ? data.names[username] : null;
      } catch {
        return PUBKEY;
      }
    }

    // Get pubkey for the handle
    let pubkeyHex;

    if( PUBKEY && PUBKEY.length === 64) {
      pubkeyHex = PUBKEY;
    }else{
      pubkeyHex = await getPubkeyFromNip05(HANDLE);
      if (!pubkeyHex) {
        return new Response("Could not resolve pubkey for handle.", {
          status: 404,
          headers: { "content-type": "text/html" }
        });
      }
    }

    // Nostr filter for latest posts (kind 1 = text note)
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30; // last 30 days
    const filter = {
      kinds: [1],
      authors: [pubkeyHex],
      limit: pageSize * page,
      since
    };

    // Try relays in order until we get a result
    let events = [];
    for (let relay of relays) {
      try {
        events = await fetchFromRelay(relay, filter);
        if (events && events.length > 0) break;
      } catch (e) {
        // Try next relay
      }
    }

    // Sort events by created_at descending
    events = events.sort((a, b) => b.created_at - a.created_at);

    // Pagination
    const start = (page - 1) * pageSize;
    const pagedEvents = events.slice(start, start + pageSize);

    // HTML rendering
    function escapeHtml(str) {
      return str.replace(/[&<>"']/g, function (m) {
        return ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[m];
      });
    }

    function renderPosts(posts) {
      if (!posts.length) {
        return `<div class="no-posts">No posts found.</div>`;
      }

      // Helper to shortify npub/event id (show first 8 + ... + last 4)
      function shortifyNpub(npub) {
        if (!npub || typeof npub !== "string") return npub;
        if (npub.length <= 16) return npub;
        return npub.slice(0, 8) + "..." + npub.slice(-4);
      }

      // Helper to linkify Nostr event references (e.g. notes, threads, quotes)
      function linkifyNostrEvents(content) {
        // Nostr note/event id: 64 hex chars or npub1... (bech32), nevent1... (bech32)
        // We'll match hex, npub, note, nevent, nprofile, etc. (bech32)
        // See: https://github.com/nostr-protocol/nips/blob/master/19.md

        // 1. Hex event id (64 hex chars)
        const hexEventRegex = /\b([a-f0-9]{64})\b/gi;

        // 2. Bech32 event references (npub1..., note1..., nevent1..., nprofile1..., etc.)
        //    Bech32 is case-insensitive, but Nostr uses lowercase. We'll match lowercase only.
        //    The minimum length for a bech32 Nostr id is about 60 chars, but can be longer.
        //    We'll match npub1, note1, nevent1, nprofile1, naddr1, nrelay1, etc.
        //    See: https://github.com/nostr-protocol/nips/blob/master/19.md#bech32-encoded-entities
        const bech32EventRegex = /\b((?:npub|note|nevent|nprofile|naddr|nrelay)1[0-9a-z]{20,})\b/g;

        // 3. NIP-21 URI scheme: nostr:<bech32>
        //    Example: nostr:nevent1qqs2sd...
        //    We'll match nostr:<bech32> and extract the bech32 part
        const nostrUriRegex = /\bnostr:((?:npub|note|nevent|nprofile|naddr|nrelay)1[0-9a-z]{20,})\b/g;

        // Replace hex event ids with coracle.social links
        content = content.replace(hexEventRegex, (match) => {
          const short = shortifyNpub(match);
          return `<a href="https://coracle.social/e/${match}" target="_blank" rel="noopener">[event:${short}]</a>`;
        });

        // Replace bech32 event ids (npub, note, nevent, etc.) with coracle.social links
        content = content.replace(bech32EventRegex, (match) => {
          // Determine type for link
          if (match.startsWith('npub1')) {
            const short = shortifyNpub(match);
            return `<a href="https://coracle.social/p/${match}" target="_blank" rel="noopener">[npub:${short}]</a>`;
          } else if (match.startsWith('note1') || match.startsWith('nevent1')) {
            const short = shortifyNpub(match);
            return `<a href="https://coracle.social/notes/${match}" target="_blank" rel="noopener">[event:${short}]</a>`;
          } else if (match.startsWith('nprofile1')) {
            const short = shortifyNpub(match);
            return `<a href="https://coracle.social/people/${match}" target="_blank" rel="noopener">[profile:${short}]</a>`;
          } else {
            // fallback
            const short = shortifyNpub(match);
            return `<a href="https://coracle.social/${match}" target="_blank" rel="noopener">[nostr:${short}]</a>`;
          }
        });

        // Replace nostr: URIs with coracle.social links
        content = content.replace(nostrUriRegex, (full, bech32) => {
          if (bech32.startsWith('npub1')) {
            const short = shortifyNpub(bech32);
            return `<a href="https://coracle.social/p/${bech32}" target="_blank" rel="noopener">[npub:${short}]</a>`;
          } else if (bech32.startsWith('note1') || bech32.startsWith('nevent1')) {
            const short = shortifyNpub(bech32);
            return `<a href="https://coracle.social/notes/${bech32}" target="_blank" rel="noopener">[event:${short}]</a>`;
          } else if (bech32.startsWith('nprofile1')) {
            const short = shortifyNpub(bech32);
            return `<a href="https://coracle.social/people/${bech32}" target="_blank" rel="noopener">[profile:${short}]</a>`;
          } else {
            // fallback
            const short = shortifyNpub(bech32);
            return `<a href="https://coracle.social/${bech32}" target="_blank" rel="noopener">[nostr:${short}]</a>`;
          }
        });

        return content;
      }

      function linkifyAndEmbed(content) {
        // Regex for URLs
        const urlRegex = /https?:\/\/[^\s<]+/g;
        // Regex for YouTube links
        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;

        // First, linkify/replace URLs (including YouTube)
        let replaced = content.replace(urlRegex, (url) => {
          const ytMatch = url.match(ytRegex);
          if (ytMatch && ytMatch[1]) {
            // YouTube embed
            const videoId = ytMatch[1];
            return `<div class="youtube-embed" style="margin:1em 0;">
              <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
            </div>`;
          } else {
            // Other links, clickable
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
          }
        });

        // Then, linkify Nostr event references
        replaced = linkifyNostrEvents(replaced);

        return replaced;
      }

      return posts.map(e => `
        <div class="post">
          <div class="content">${linkifyAndEmbed(escapeHtml(e.content))}</div>
          <div class="meta">${new Date(e.created_at * 1000).toLocaleString()}</div>
        </div>
      `).join("");
    }

    // Pagination controls
    const totalPages = Math.ceil(events.length / pageSize);
    function renderPagination(page, totalPages) {
      let controls = '';
      if (page > 1) {
        controls += `<a href="?page=${page - 1}">&laquo; Prev</a>`;
      }
      controls += ` <span>Page ${page} of ${totalPages || 1}</span> `;
      if (page < totalPages) {
        controls += `<a href="?page=${page + 1}">Next &raquo;</a>`;
      }
      return `<div class="pagination">${controls}</div>`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Latest posts from delirehberi@emre.xyz</title>
        <style>
          :root {
            --bg: #f9f9f9;
            --container-bg: #fff;
            --text: #222;
            --meta: #888;
            --border: #eee;
            --link: red;
            --container-shadow: 0 2px 8px #0001;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #181a1b;
              --container-bg: #23272a;
              --text: #f1f1f1;
              --meta: #b0b0b0;
              --border: #333a;
              --link: red;
              --container-shadow: 0 2px 16px #0008;
            }
          }
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--text);
            font-family: system-ui, sans-serif;
            min-height: 100vh;
          }
          .container {
            max-width: 600px;
            margin: 2em auto;
            background: var(--container-bg);
            border-radius: 14px;
            box-shadow: var(--container-shadow);
            padding: 2em 1.5em;
            box-sizing: border-box;
          }
          h1 {
            font-size: 2em;
            margin-bottom: 1.2em;
            font-weight: 700;
            letter-spacing: -1px;
            color: var(--text);
            text-align: center;
          }
          .post {
            border-bottom: 1px solid var(--border);
            padding: 1.2em 0;
            word-break: break-word;
          }
          .post:last-child {
            border-bottom: none;
          }
          .content {
            font-size: 1.13em;
            margin-bottom: 0.5em;
            line-height: 1.6;
          }
          .meta {
            color: var(--meta);
            font-size: 0.93em;
            margin-top: 0.2em;
          }
          .pagination {
            margin: 2em 0 0 0;
            text-align: center;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.5em;
            flex-wrap: wrap;
          }
          .pagination a {
            color: var(--link);
            text-decoration: none;
            margin: 0 0.5em;
            padding: 0.3em 0.9em;
            border-radius: 5px;
            transition: background 0.15s;
            font-weight: 500;
          }
          .pagination a:hover, .pagination a:focus {
            background: var(--border);
            outline: none;
          }
          .pagination span {
            color: var(--text);
            font-size: 1em;
          }
          .no-posts {
            color: var(--meta);
            text-align: center;
            margin: 2em 0;
            font-size: 1.1em;
          }
          .youtube-embed {
            margin: 1em 0;
            border-radius: 8px;
            overflow: hidden;
            background: #000;
          }
          /* Make all links red, including those in .content */
          a, .content a {
            color: red !important;
          }
          @media (max-width: 700px) {
            .container {
              max-width: 98vw;
              margin: 1em auto;
              padding: 1.2em 0.5em;
            }
            h1 {
              font-size: 1.3em;
            }
            .content {
              font-size: 1em;
            }
          }
          @media (max-width: 480px) {
            .container {
              padding: 0.7em 0.2em;
            }
            .post {
              padding: 0.8em 0;
            }
            .pagination {
              font-size: 0.98em;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>My Notes on Nostr</h1>
          ${renderPosts(pagedEvents)} 

          <p style="margin: 8px 0 0 0; font-size: 12px; color: var(--meta); text-align:center;">
            Want to see all my posts and follow me?<br>
            You can use 
            <a href="https://coracle.social/people/46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a" 
               target="_blank" rel="noopener" style="color:var(--link);word-break:break-all;">
              [delirehberi@emre.xyz]
            </a>
          </p>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  }
};


