import { html, raw } from 'hono/html';
import { nip19 } from 'nostr-tools';

// Helper to escape HTML characters
function escapeHtml(str) {
    if (!str) return '';
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

function shortifyNpub(npub) {
    if (!npub || typeof npub !== "string") return npub;
    if (npub.length <= 16) return npub;
    return npub.slice(0, 8) + "..." + npub.slice(-4);
}

// Simple bech32 decode helpers (minimal implementation for npub/nprofile)
function decodeBech32(bech32str) {
    try {
        // This is a simplified version - in production you'd use nostr-tools
        // For now, we'll use a basic approach to extract the hex pubkey
        // npub = bech32 encoding of pubkey
        // nprofile = bech32 encoding of profile data including pubkey

        // Since we can't easily decode bech32 client-side without a library,
        // we'll pass the bech32 string to a lookup function
        return { type: bech32str.startsWith('npub') ? 'npub' : 'nprofile', data: bech32str };
    } catch (e) {
        return null;
    }
}

function linkifyNostrEvents(content, profileMap) {
    const bech32EventRegex = /(?<!^https:\/\/)\b((?:npub|note|nevent|nprofile|naddr|nrelay)1[0-9a-z]{20,})\b/g;
    const nostrUriRegex = /\bnostr:((?:npub|note|nevent|nprofile|naddr|nrelay)1[0-9a-z]{20,})\b/g;

    content = content.replace(bech32EventRegex, (match) => {
        const short = shortifyNpub(match);
        let label = short;

        // Decode npub/nprofile to hex and look up in profileMap
        if (match.startsWith('npub1') || match.startsWith('nprofile1')) {
            try {
                const decoded = nip19.decode(match);
                let pubkey;
                if (decoded.type === 'npub') {
                    pubkey = decoded.data;
                } else if (decoded.type === 'nprofile') {
                    pubkey = decoded.data.pubkey;
                }

                if (pubkey && profileMap.has(pubkey)) {
                    const profile = profileMap.get(pubkey);
                    label = profile.name || profile.display_name || short;
                }
            } catch (e) {
                // ignore decode errors
            }
        }

        if (match.startsWith('npub1') || match.startsWith('nprofile1')) {
            return `<a href="https://njump.me/${match}" target="_blank" rel="noopener">@${label}</a>`;
        } else if ((match.startsWith('note1') || match.startsWith('nevent1'))) {
            return `<a href="https://njump.me/${match}" target="_blank" rel="noopener">[event:${short}]</a>`;
        } else if (match.startsWith('naddr1') || match.startsWith('nrelay1')) {
            return `<a href="https://njump.me/${match}" target="_blank" rel="noopener">[nostr:${short}]</a>`;
        } else {

            return `<a href="https://njump.me/${match}" target="_blank" rel="noopener">[nostr:${short}]</a>`;
        }
    });
    content = content.replace(/nostr\:/g, '');
    content = content.replace(nostrUriRegex, (full, bech32) => {
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

                if (pubkey && profileMap.has(pubkey)) {
                    const profile = profileMap.get(pubkey);
                    label = profile.name || profile.display_name || short;
                }
            } catch (e) {
                // ignore decode errors
            }
            return `<a href="https://njump.me/${full}" target="_blank" rel="noopener">@${label}</a>`;
        } else if (bech32.startsWith('note1') || bech32.startsWith('nevent1')) {
            return `<a href="https://njump.me/${full}" target="_blank" rel="noopener">[event:${short}]</a>`;
        } else {
            return `<a href="https://njump.me/${full}" target="_blank" rel="noopener">[nostr:${short}]</a>`;
        }
    });

    return content;
}

function linkifyAndEmbed(content, profileMap) {
    const urlRegex = /https?:\/\/[^\s<]+/g;
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
    const videoRegex = /(https?:\/\/[^\s<]+?\.(?:mp4|webm|ogg))(?=[^\w.]|$)/;
    const imgRegex = /(https?:\/\/[^\s<]+?\.(?:jpe?g|png|gif|bmp|webp))(?=[^\w.]|$)/;

    let replaced = content.replace(urlRegex, (url) => {
        // YouTube
        const ytMatch = url.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            const videoId = ytMatch[1];
            return `<div class="youtube-embed">
              <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
            </div>`;
        }

        // Native Video
        if (videoRegex.test(url)) {
            // Create a random ID for the container to easily reference it if needed, 
            // but strictly we can pass the URL to the function.
            const cleanUrl = escapeHtml(url);
            return `<div class="video-container" onclick="loadVideo(this, '${cleanUrl}')">
                <div class="play-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <span style="font-size:0.9em; margin-top:0.5em; color:var(--meta)">Play Video</span>
             </div>`;
        }

        // Image
        if (imgRegex.test(url)) {
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(url)}" class="post-image" loading="lazy" />
            </a>`;
        }

        // Fallback Link
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
    });

    replaced = linkifyNostrEvents(replaced, profileMap);
    return replaced;
}

function formatContent(content, profileMap) {
    let cont = escapeHtml(content);

    const contentWithBr = cont.replace(/\n/g, '<br>');
    return linkifyAndEmbed(contentWithBr, profileMap);
}

function renderProfile(pubkey, profileMap) {
    const profile = profileMap.get(pubkey) || {};
    const name = profile.name || profile.display_name || shortifyNpub(pubkey);

    // Fallback avatar
    const picture = profile.picture || `https://robohash.org/${pubkey}?set=set5`;

    return `
    <div class="user-info">
        <img src="${escapeHtml(picture)}" alt="${escapeHtml(name)}" class="user-avatar" loading="lazy" />
        <span class="user-name">${escapeHtml(name)}</span>
    </div>`;
}

function renderPosts(mainEventIds, eventMap, profileMap) {
    if (!mainEventIds || !mainEventIds.length) {
        return html`<div class="no-posts">No posts found.</div>`;
    }

    const postsHtml = mainEventIds.map(id => {
        const e = eventMap.get(id);
        if (!e) return '';

        let parentId = null;
        if (Array.isArray(e.tags)) {
            const eTags = e.tags.filter(tag => tag[0] === 'e' && tag[1] && tag[1] !== e.id);
            if (eTags.length > 0) {
                parentId = eTags[eTags.length - 1][1];
            }
        }

        let parentBlock = '';
        if (parentId) {
            const parentEvent = eventMap.get(parentId);
            if (parentEvent) {
                parentBlock = `
                <div class="parent-post">
                    ${renderProfile(parentEvent.pubkey, profileMap)}
                    <div class="post-content parent-content" style="opacity: 0.8; font-size: 0.95em;">
                        ${formatContent(parentEvent.content, profileMap)}
                    </div>
                    <div class="post-meta" style="font-size: 0.8em;">
                       <a href="https://njump.me/${parentEvent.id}" target="_blank" style="color:inherit">view original</a>
                    </div>
                </div>`;
            } else {
                parentBlock = `<div class="parent-link" style="font-size:0.95em;margin-bottom:0.5em;">
                    <a href="https://njump.me/${parentId}" target="_blank" rel="noopener" style="color:var(--meta);text-decoration:underline;">
                      Replying to event: ${parentId.slice(0, 8)}...${parentId.slice(-4)}
                    </a>
                </div>`;
            }
        }

        const finalContent = formatContent(e.content, profileMap);

        return `
        <div class="post">
          ${parentBlock}
          <div class="post-header">
            ${renderProfile(e.pubkey, profileMap)}
          </div>
          <div class="post-content">${finalContent}</div>
          <div class="post-meta">
            <span>${new Date(e.created_at * 1000).toLocaleString()}</span>
            <a href="https://njump.me/${e.id}" target="_blank" style="color:inherit">share</a>
          </div>
        </div>
        `;
    }).join("");

    return raw(postsHtml);
}

export const renderHomePage = (mainEventIds, eventMap, profileMap) => {
    const css = `
    :root {
      --bg: #f9f9f9;
      --container-bg: #fff;
      --text: #222;
      --meta: #888;
      --border: #eee;
      --link: #d93025;
      --container-shadow: 0 2px 8px rgba(0,0,0,0.05);
      --blockquote: #fafafa;
      --parent-bg: #f5f5f5;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #181a1b;
        --container-bg: #23272a;
        --text: #f1f1f1;
        --meta: #b0b0b0;
        --border: #333a;
        --link: #f25c54;
        --blockquote: #2c2f33;
        --parent-bg: #2c2f33;
      }
    }

    /* Manual overrides */
    :root[data-theme="light"] {
      --bg: #f9f9f9;
      --container-bg: #fff;
      --text: #222;
      --meta: #888;
      --border: #eee;
      --link: #d93025;
      --container-shadow: 0 2px 8px rgba(0,0,0,0.05);
      --blockquote: #fafafa;
      --parent-bg: #f5f5f5;
    }

    :root[data-theme="dark"] {
      --bg: #181a1b;
      --container-bg: #23272a;
      --text: #f1f1f1;
      --meta: #b0b0b0;
      --border: #333a;
      --link: #f25c54;
      --blockquote: #2c2f33;
      --parent-bg: #2c2f33;
      --parent-bg: #2c2f33;
    }

    html, body {
      margin: 0; padding: 0;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      line-height: 1.5;
    }
    a { text-decoration: none; color: var(--link); }
    a:hover { opacity: 0.8; }
    
    .container {
      max-width: 680px;
      margin: 0 auto;
      background: var(--container-bg);
      min-height: 100vh;
      box-shadow: 0 0 20px rgba(0,0,0,0.05);
    }
    @media (min-width: 700px) {
        .container {
            margin: 2em auto;
            border-radius: 12px;
            min-height: auto;
        }
    }
    
    header {
      padding: 1.5em;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; }
    
    .header-actions {
      display: flex;
      gap: 1em;
      align-items: center;
    }
    
    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text);
      padding: 5px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }
    .icon-btn:hover {
      background-color: var(--border);
    }

    /* Simple home icon SVG */
    .icon-home {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    .post { padding: 1.5em; border-bottom: 1px solid var(--border); word-break: break-word; }
    .post:last-child { border-bottom: none; }
    
    .post-header { margin-bottom: 0.5em; }

    .user-info {
        display: flex;
        align-items: center;
        gap: 0.6em;
        margin-bottom: 0.5em;
    }
    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--border);
        object-fit: cover;
    }
    .user-name {
        font-weight: 600;
        font-size: 0.95rem;
    }

    .post-content { font-size: 1.05rem; margin-bottom: 0.75em; line-height: 1.6; }
    .post-meta { font-size: 0.85rem; color: var(--meta); display: flex; gap: 1em; }
    
    .parent-post {
        margin-bottom: 1em;
        padding: 1em;
        background: var(--parent-bg);
        border-radius: 8px;
        border-left: 3px solid var(--link);
        position: relative;
    }
    .parent-post .user-avatar {
        width: 24px;
        height: 24px;
    }
    .parent-post .user-name {
        font-size: 0.9rem;
    }
    
    .parent-post::after {
        content: '';
        position: absolute;
        left: 20px;
        bottom: -20px;
        width: 2px;
        height: 20px;
        background: var(--border);
        z-index: 0;
    }
    
    .no-posts { padding: 4em; text-align: center; color: var(--meta); }
    
    .youtube-embed { margin: 1em 0; aspect-ratio: 16 / 9; background: #000; border-radius: 8px; overflow: hidden; }
    .youtube-embed iframe { width: 100%; height: 100%; }
    
    .post-image {
        max-height: 150px;
        width: auto;
        max-width: 100%;
        border-radius: 8px;
        border: 1px solid var(--border);
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .post-image:hover { opacity: 0.9; }

    /* Video Placeholder */
    .video-container {
        height: 150px;
        width: auto;
        aspect-ratio: 16 / 9;
        background: var(--border);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
        margin: 1em 0;
        overflow: hidden;
    }
    .video-container:hover {
        background: var(--meta);
        color: white;
    }
    .play-icon {
        width: 48px;
        height: 48px;
        background: rgba(0,0,0,0.5);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
    .play-icon svg {
        width: 32px;
        height: 32px;
    }
    video {
        max-width: 100%;
        max-height: 400px;
        border-radius: 8px;
        background: black;
    }
    
    @media (max-width: 480px) {
      header { padding: 1em; }
      .post { padding: 1em; }
      .post-content { font-size: 1rem; }
    }
  `;

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>My Notes on Nostr | @delirehberi</title>
      <style>${css}</style>
      <script>
        // Init theme
        (function() {
          const stored = localStorage.getItem('theme');
          if (stored) {
            document.documentElement.setAttribute('data-theme', stored);
          }
        })();

        function toggleTheme() {
          const current = document.documentElement.getAttribute('data-theme');
          const isDark = current === 'dark' || (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
          const next = isDark ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        }

        function loadVideo(container, url) {
            container.outerHTML = '<video src="' + url + '" controls autoplay playsinline></video>';
        }
      </script>
    </head>
    <body>
      <div class="container">
        <header>
          <h1><a href="/" style="color:var(--text)">My Notes on Nostr</a></h1>
          <div class="header-actions">
            <!-- Theme Toggler -->
            <button class="icon-btn" onclick="toggleTheme()" aria-label="Toggle Theme" title="Toggle Theme">
               <svg class="icon-home" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                 <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
               </svg>
            </button>
            
            <!-- Home Link -->
            <a href="https://emre.xyz" class="icon-btn" aria-label="Go to Home" title="Go to emre.xyz">
              <svg class="icon-home" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </a>
          </div>
        </header>         
        <main>
          ${renderPosts(mainEventIds, eventMap, profileMap)}
        </main>
        <footer style="padding: 2em; text-align: center; color: var(--meta); font-size: 0.85rem; border-top: 1px solid var(--border);">
             <p>
              Follow me: 
              <a href="https://njump.me/npub1gmeu0wenescpjpymwmwgnkaedc6vy3aamf5tdtvxxf5z0yll3gdqatwl3v" target="_blank" rel="noopener">
                delirehberi@emre.xyz
              </a>
            </p>
        </footer>
      </div>
    </body>
    </html>
  `;
};
