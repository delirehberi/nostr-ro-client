# Nostr Read-only Client

A lightweight Cloudflare Worker that fetches and renders your Nostr kind:1 notes as a static web page. No database, no authentication — just a fast, personal read-only feed.

**Live demo:** [nostr.emre.xyz](https://nostr.emre.xyz)

---

## Features

- Fetches kind:1 notes from multiple Nostr relays via WebSocket
- Resolves identity via NIP-05 or direct hex pubkey
- Renders inline parent/reply context (one level deep)
- Displays user avatars and display names (kind:0 profiles)
- Embeds images, YouTube videos, and lazy-loaded native video
- Decodes `npub`/`nprofile`/`note`/`nevent` mentions with links to [njump.me](https://njump.me)
- Dark/light mode toggle with `localStorage` persistence
- HTML response cached in Cloudflare KV — invalidated on demand via query string

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Framework | [Hono](https://hono.dev) |
| Nostr | [nostr-tools](https://github.com/nbd-wtf/nostr-tools) (NIP-19) |
| Storage | Cloudflare KV |
| Tooling | Wrangler, Vitest |

## Requirements

- [Node.js](https://nodejs.org) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-upgrade/)
- A Cloudflare account with Workers and KV enabled

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/delirehberi/nostr.emre.xyz.git
cd nostr.emre.xyz

# 2. Install dependencies
npm install

# 3. Authenticate with Cloudflare
npx wrangler login
```

## Configuration

All configuration lives in `wrangler.jsonc`. Update the following before deploying:

| Key | Description |
|-----|-------------|
| `vars.HANDLE` | Your NIP-05 identifier (e.g. `you@yourdomain.com`) |
| `vars.PUBKEY` | Your Nostr public key in hex format (fallback if NIP-05 fails) |
| `routes[0].pattern` | Your domain (e.g. `nostr.yourdomain.com`) |
| `routes[0].zone_name` | Your Cloudflare zone (e.g. `yourdomain.com`) |
| `kv_namespaces[0].id` | Your Cloudflare KV namespace ID |

### Creating a KV namespace

```bash
npx wrangler kv namespace create CACHE
# Use the returned id in wrangler.jsonc → kv_namespaces[0].id
```

## Development

```bash
npx wrangler dev
```

Opens a local dev server at `http://localhost:8787`.

## Deployment

```bash
npx wrangler deploy
```

## Caching

Rendered HTML is stored in Cloudflare KV under the key `homepage`. Subsequent requests are served directly from KV without hitting any Nostr relay.

To invalidate and repopulate the cache:

```
GET https://your-worker-domain/?cache=invalidate
```

Point a cron job at this URL to keep content fresh on a schedule. Any HTTP-based scheduler works (cron job, GitHub Actions, Cloudflare Cron Triggers, etc.).

## Project Structure

```
src/
  index.js    — Hono app: routing, relay fetching, data aggregation
  views.js    — Server-side HTML rendering, CSS, inline JS
test/
  index.spec.js  — Vitest test suite
wrangler.jsonc   — Cloudflare Worker configuration
vitest.config.js — Test configuration
```

## Testing

```bash
npx vitest
```

Tests run inside the Cloudflare Workers runtime via `@cloudflare/vitest-pool-workers`.

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes
4. Open a pull request describing what you changed and why

Please keep changes focused and avoid unnecessary refactoring in unrelated areas.

## License

MIT
