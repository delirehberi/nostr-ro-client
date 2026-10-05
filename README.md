# Single-User Nostr Client

A modern, single-user read-only Nostr client deployed as a Cloudflare Worker. Fetches and renders all kinds of Nostr events (Notes, Books, Movies, Media, Lists, Articles, Highlights) with human-friendly category tabs, sub-filtering, and client-side relay WebSocket streaming.

**Live demo:** [nostr.emre.xyz](https://nostr.emre.xyz)

---

## Features

- **Multi-Kind Event Feed**: Fetches all Nostr event kinds authored by the user directly from Nostr relays.
- **Human-Friendly Category Filters**:
  - **Notes**: Root posts, replies with thread context, and reposts.
  - **Books (Bookstr.xyz)**: Native support for Kind 30040 / 30041, NIP-51 reading sets (`books-reading`, `books-read`, `books-to-read`), and reviews (`books:rated`).
  - **Movies**: Support for movie sets (`movies-watched`, `movies-watchlist`) and NIP-32 ratings/reviews (`movies:rated`) with IMDB / TMDB integration.
  - **Media**: Photos (Kind 20), Videos (Kind 21/22), file metadata (Kind 1063), and media posts.
  - **Lists & Curations**: People sets (Kind 30000), Bookmark sets (Kind 30001/30003/10003), and Curated sets.
  - **Articles**: Long-form articles (Kind 30023) linked directly to [blog.emre.xyz](https://blog.emre.xyz).
  - **Highlights**: Kind 9802 quotation snippets.
- **Granular Sub-Filters**: Fast facet switching (`movies:watched`, `movies:rated`, `books:reading`, `media:photos`, etc.).
- **Client-side Architecture**:
  - Static React SPA served by a Cloudflare Worker (static assets + cache/security headers).
  - The browser queries relays over WebSocket (signatures verified) for filtering and infinite scroll (`until: timestamp`).
- **Nostr Theme Engine**: Automatic styling via Kind 16767 / 36767 custom theme events and dark mode.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (static assets) |
| Framework | React 19 + Vite |
| Nostr | [nostr-tools](https://github.com/nbd-wtf/nostr-tools) (NIP-19) |
| Tooling | Wrangler, Vitest |

---

## Development

```bash
# Verify Node and run dev server
nvm use
npx wrangler dev
```

## Testing

```bash
nvm use
npx vitest run
```

## Deployment

```bash
npx wrangler deploy
```

## License

MIT
