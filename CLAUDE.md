# nostr.emre.xyz — Cloudflare Worker

Read-only Nostr client deployed as a Cloudflare Worker. Fetches and renders kind:1 notes for a specific user via WebSocket relays.

Live at: https://nostr.emre.xyz

## Project Structure

```
src/
  index.js    — Hono app: relay fetching, data aggregation, route handler
  views.js    — SSR HTML rendering, CSS (CSS variables theming), inline JS
test/
  index.spec.js  — Vitest tests (uses @cloudflare/vitest-pool-workers)
wrangler.jsonc   — Cloudflare Worker config (name, route, vars)
vitest.config.js — Vitest config pointing to wrangler.jsonc
```

## Key Dependencies

- **hono** — Web framework for Cloudflare Workers
- **nostr-tools** — NIP-19 bech32 encoding/decoding (npub, nprofile, note, nevent)
- **wrangler** — Cloudflare CLI for dev and deploy
- **@cloudflare/vitest-pool-workers** — Run tests in the Workers runtime

## Commands

```bash
npx wrangler dev       # local dev server
npx wrangler deploy    # deploy to Cloudflare
npx vitest             # run tests
```

## Configuration (wrangler.jsonc)

- Worker name: `nostr`
- Entry: `src/index.js`
- Route: `nostr.emre.xyz` (zone: `emre.xyz`)
- Vars: `HANDLE=delirehberi@emre.xyz`, `PUBKEY=46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a`

## Data Flow (src/index.js)

1. Resolve pubkey from `c.env.PUBKEY` or NIP-05 lookup via `c.env.HANDLE`
2. Fetch kind:1 events (last 30 days, limit 500) from relay list via WebSocket
3. Identify missing parent events (reply context) and fetch them
4. Collect all author pubkeys + mentioned npub/nprofile in content
5. Fetch kind:0 profiles for all collected pubkeys
6. Render via `renderHomePage(mainEventIds, eventMap, profileMap)`
7. Return HTML with `Cache-Control: public, max-age=60`

Relays (in order of priority):
- wss://relay.emre.xyz
- wss://relay.nostr.band
- wss://relay.damus.io
- wss://nostr-pub.wellorder.net

## Rendering (src/views.js)

- `renderHomePage()` — full HTML page (CSS vars, inline JS, header, posts)
- `renderPosts()` — maps event IDs to post HTML, includes inline parent context
- `formatContent()` — escapeHtml → nl2br → linkifyAndEmbed
- `linkifyAndEmbed()` — handles YouTube embeds, video placeholders (lazy-load), image thumbnails, fallback links
- `linkifyNostrEvents()` — decodes npub/nprofile/note/nevent via nip19, links to njump.me
- Theme: CSS `--variable` system, `data-theme` on `<html>`, persisted to localStorage

## Code Style

Prettier config: `printWidth: 140`, `singleQuote`, `semi`, `useTabs`

## Notes

- No pagination — displays all fetched events (up to 500)
- No build step — ES modules used directly by the Workers runtime
- `test/index.spec.js` is a stale scaffold (expects "Hello World!" — does not match current behavior)
- Profile picture fallback: `https://robohash.org/{pubkey}?set=set5`
- External links use njump.me for all Nostr entities
