# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# nostr.emre.xyz — React SPA & Nostr Client

Single-user read-only Nostr client built with React 19 and Vite, deployed on Cloudflare Workers with Static Assets. Fetches and renders all kinds of Nostr events (Notes, Books, Movies, Media, Lists, Articles, Highlights) with human-friendly category tabs, sub-filtering, and client-side relay WebSocket streaming.

Live at: https://nostr.emre.xyz

## Project Structure

```
src/
  components/
    SimpleTextPostComponent.jsx — Notes (Kind 1, 6, 16, 1111) with reply thread hierarchy
    MovieComponent.jsx          — Movies (lists, NIP-32 reviews, TMDb/IMDb cards & ratings)
    BookComponent.jsx           — Books (Bookstr, NIP-51 reading lists, ISBN covers, ratings)
    ArticleComponent.jsx        — Long-form articles (Kind 30023/30024 linking to blog.emre.xyz)
    MediaComponent.jsx          — Photos (Kind 20) and Videos (Kind 21/22/1063)
    ListComponent.jsx           — Sets & lists (Kind 30000 people, bookmarks, curations)
    HighlightComponent.jsx      — Kind 9802 quotation cards
    GenericComponent.jsx        — Fallback structured cards with kind badges
    EventCard.jsx               — Central component dispatcher based on classifyEvent
    FilterBar.jsx               — Category navigation tabs and sub-filter pills
    ProfileAvatar.jsx           — User profile, avatar, and NIP-05 badge
    RatingStars.jsx             — 5-star rating renderer
    FormattedContent.jsx        — Linkifier, media embeds (YouTube/Video/Image), Nostr mentions
    ReactionComponent / GitEventComponent / AppHandlerComponent / SnippetComponent / QuotedEventCard / CommunityBadge — specialized cards for kinds 7, git, 31989/31990, snippets, quotes, communities
  hooks/
    useNostrFeed.js             — Multi-relay WebSocket streaming, deduplication, infinite scroll
    useProfiles.js              — Batched Kind 0 profile fetcher & caching
    useTheme.js                 — Kind 16767 / 36767 custom theme loader
    useBookMetadata.js / useMovieMetadata.js — external metadata lookups for cards
  relays.js                     — Cache relay URL builder and relay URL sanitizing
  kinds.js                      — Event classification taxonomy and metadata extraction
  theme.js                      — Nostr Kind 16767 & 36767 theme parser & CSS generator
  styles.css                    — CSS custom properties, responsive card styles, dark mode
  App.jsx                       — Top-level SPA layout and URL state router
  main.jsx                      — React 19 root mount
  index.js                      — Cloudflare Worker static asset handler (cache + security headers)
test/
  components.spec.jsx           — Component unit and integration tests
  kinds.spec.js                 — Classification & metadata extraction tests
  theme.spec.js                 — Theme parser and CSS generation tests
  relays.spec.js / community-badge.spec.jsx — Relay URL and CommunityBadge tests
  index.spec.js                 — Worker asset, cache and header tests
index.html                      — SPA HTML entry with emre.xyz header/footer custom elements
vite.config.js                  — Vite bundler and Vitest configuration
wrangler.jsonc                  — Cloudflare Worker configuration with SPA static assets
```

## Architecture

- **No backend logic.** `src/index.js` is a Worker that serves `env.ASSETS` and adds cache/security headers (CSP is report-only). All Nostr work happens in the browser.
- **Relays** (`src/relays.js`): the client talks to a single cache relay (`wss://cache.nostr.org.tr?relays=...`) that proxies upstream relays; `getDefaultRelays()` builds that URL. Hooks open raw `WebSocket`s and speak NIP-01 (`REQ`/`EVENT`/`EOSE`) directly — `nostr-tools` is used only for NIP-19 encoding.
- **Data flow**: `App.jsx` hardcodes the owner pubkey and calls `useNostrFeed` (streams events by `authors: [pubkey]`, paginates backwards with `until`, dedupes into an `eventMap`, and fetches missing parent events by id for reply threads/quotes), `useProfiles` (batched Kind 0), and `useTheme` (applies the owner's Kind 16767/36767 theme). `useBookMetadata`/`useMovieMetadata` enrich cards from external APIs.
- **Classification is the core abstraction**: `kinds.js` `classifyEvent(event)` returns `{category, subCategory}` and drives the FilterBar tabs, feed filtering, and which component `EventCard.jsx` renders (EventCard also special-cases kinds like 7, 31990/31989, 1337, git and snippet events before falling back to category dispatch). `CATEGORIES_CONFIG` defines tabs/sub-filters, and `CATEGORY_KINDS_MAP` in `useNostrFeed.js` maps categories to relay kind filters. Adding a kind/category usually means touching `classifyEvent`, `CATEGORIES_CONFIG`, `CATEGORY_KINDS_MAP`, and `EventCard`, plus a case in `test/kinds.spec.js`.
- **URL state**: `App.jsx` syncs `?kind=&sub=` (and a single-post view) with `history.pushState`/`popstate`; no router library.
- `todo.md` is an unrelated, stale Haskell/Miso prompt — ignore it.

## Supported Categories & Event Kinds

- **Notes**: Kind 1 (Text notes), Kind 1111 (Comments), Kind 6/16 (Reposts) — sub-filters: `all`, `posts`, `replies`, `reposts`.
- **Books**: Bookstr.xyz standard (Kind 30040 / 30041), NIP-51 reading lists (Kind 30001 with `books-*`), NIP-32 reviews (Kind 1985) — sub-filters: `all`, `reading`, `read`, `to-read`, `rated`.
- **Movies**: Movie lists (Kind 30001/30003 with `movies-*`), NIP-32 reviews (Kind 1985 with IMDB/TMDB rating tags) — sub-filters: `all`, `watched`, `rated`, `watchlist`.
- **Media**: Kind 20 (Photos), Kind 21/22 (Videos), Kind 1063 (File metadata), Kind 1 media posts — sub-filters: `all`, `photos`, `videos`.
- **Lists**: Kind 30000 (People sets), Kind 30001 (Generic sets), Kind 30003 (Bookmarks), Kind 30004 (Articles), Kind 10003 (Bookmarks) — sub-filters: `all`, `people`, `bookmarks`, `curations`.
- **Articles**: Kind 30023 / 30024 with canonical cards linking directly to `https://blog.emre.xyz`.
- **Highlights**: Kind 9802 quotation cards with source attribution.
- **Other**: Fallback structured cards with kind badges.

## Commands

```bash
make help              # list all available make commands
make dev               # local dev server (vite)
make build             # build production bundle (vite build)
make test              # run full test suite (vitest run)
make test-watch        # run test suite in watch mode
make deploy            # build and deploy to Cloudflare
make tail              # tail live worker logs
make clean             # clean local build/cache artifacts (only removes .wrangler)
```

Run a single test file or test name (there is no linter/formatter script; `.prettierrc` and `.editorconfig` define style):

```bash
npx vitest run test/kinds.spec.js
npx vitest run test/components.spec.jsx -t "partial test name"
```

Vitest runs under jsdom with globals enabled (config in `vitest.config.js`). Hook/component tests use `test/helpers/mockWebSocket.js`; specs that sign real events need `// @vitest-environment node` (noble crypto rejects jsdom Uint8Arrays). CI (`.github/workflows/ci.yml`) runs tests and the build.

## Configuration (wrangler.jsonc)

- Worker name: `nostr`
- Route: `nostr.emre.xyz` (zone: `emre.xyz`)
- Static assets directory: `./dist` (with SPA fallback)
- Vars: `HANDLE=delirehberi@emre.xyz`, `PUBKEY=46f3c7bb33cc3019049b76dc89dbb96e34c247bdda68b6ad8632682793ff8a1a`
