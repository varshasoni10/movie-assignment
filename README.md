# Reel — Movie Discovery App

React + Node.js (Express) app for browsing, searching and saving movies. Movie data comes from
[TMDB](https://www.themoviedb.org/documentation/api); the browser only ever talks to our backend.

## Setup

Requires **Node 22.13+** (uses the built-in `node:sqlite`, so there is no native build step).

```bash
npm run install:all      # installs root, server and client dependencies
cp server/.env.example server/.env   # then add your TMDB credentials (see below)
npm run dev              # API on :4000, web app on :5173 (proxying /api)
```

Open http://localhost:5173.

**TMDB credentials:** create a free account, then copy either the *API Read Access Token* (`TMDB_READ_TOKEN`)
or the *API Key* (`TMDB_API_KEY`) from https://www.themoviedb.org/settings/api into `server/.env`.

**No key? It still runs.** Without credentials the server falls back to an offline *sample provider*
(~300 generated titles with seeded stock photos, including long titles, odd poster ratios and missing data)
so every feature can be exercised. Force it with `MOVIE_PROVIDER=sample`; use `SAMPLE_FAIL_RATE=0.3` and
`SAMPLE_LATENCY_MS=1500` to watch the loading/error/retry states.

Production: `npm run build && npm start` — Express serves the built client and API from one port.
Tests: `npm test` (19 tests: cache, TMDB normalization, API + wishlist integration).

## Architecture

```
React (Vite) ──/api──▶ Express ──▶ MovieService ──▶ Cache (TTL, LRU, in-flight dedupe, stale-if-error)
                          │                              └─▶ Provider (tmdb | sample) ─▶ Scheduler (rate limit, retry, timeout) ─▶ TMDB
                          └─▶ SQLite (wishlist only)
```

```
server/src
  config.js            env → typed config
  providers/           tmdb.js (all TMDB quirks + normalization), sample.js (offline catalogue)
  services/movies.js   provider + cache; the only thing routes talk to
  lib/cache.js         TTL/LRU cache, request coalescing, stale-if-error
  lib/upstream.js      outbound HTTP: timeout, retries, Retry-After, concurrency + spacing limiter
  routes/              movies.js, wishlist.js (validation lives here)
  db.js                SQLite schema + wishlist repository
client/src
  api/client.js        fetch wrapper, ApiError, anonymous client id
  hooks/               useMovies, useWishlist, useInfiniteScroll, useScrollRestoration
  pages/               BrowsePage, MoviePage, WishlistPage
  components/          Header, FilterBar, MovieGrid/Card, States, Toast
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/movies?query=&genre=&year=&sort=&page=` | Paginated list: `{ items, page, totalPages, totalResults, hasMore, stale }` |
| `GET /api/movies/:id` | Full detail (cast, director, trailer, genres) |
| `GET /api/genres` | Genres + available sort options (drives the filter UI) |
| `GET /api/wishlist?offset=&limit=` · `GET /api/wishlist/ids` | Saved movies (paginated) / just the ids |
| `POST /api/wishlist {movieId}` · `DELETE /api/wishlist/:id` | Add / remove (both idempotent) |

Errors are always `{ error: { code, message } }` with a meaningful status (400 bad param, 404, 429, 502/504 upstream).

## Key technical decisions

- **Own data model, not TMDB's.** Providers return normalized `MovieSummary`/`MovieDetail` objects
  (`posterUrl` already absolute, `rating: null` when unrated instead of `0`, `year` parsed, missing fields
  explicit `null`). Records without an id/title are dropped. The client never sees upstream field names, so
  swapping provider only touches one file.
- **What we store vs. fetch.** Only the wishlist is stored (SQLite). Catalogue data is owned by TMDB and is
  cached in memory with TTLs (lists 5 min, details 30 min, genres 24 h). A wishlist row keeps a small
  snapshot (title/year/poster/rating) so the wishlist page is one indexed query and survives an outage.
  The snapshot is built server-side from validated data, never from the client's payload.
- **Wishlist identity.** No accounts in scope, so each browser generates a UUID (localStorage) sent as
  `X-Client-Id`; rows are keyed `(client_id, movie_id)`. Persists across sessions/restarts; not across devices.
- **Repeated requests.** Server: cache key is the normalized query (`"IRON"` and `"iron "` share an entry).
  Client: react-query keys by filters, so going back to an earlier search costs nothing; `Cache-Control` headers set.
- **Fast typing / filter changes.** Search is debounced (350 ms); react-query aborts the superseded request
  via `AbortSignal`; the previous grid stays visible (dimmed) instead of flashing skeletons; typing *replaces*
  the history entry so Back doesn't replay keystrokes.
- **Concurrent identical requests** are coalesced into one upstream call (in-flight map).
- **Slow / failing upstream.** 8 s timeout, up to 2 retries with backoff+jitter on 5xx/network/429 (honouring
  `Retry-After`), no retries on other 4xx. If it still fails and we hold an expired cached copy, we serve it
  flagged `stale: true` (UI shows a banner); otherwise a clean 502/504 with a retry button in the UI.
- **Rate limits.** Outbound scheduler caps concurrency (6) and spaces call starts (30 ms), with a bounded queue
  so overload fails fast. Inbound per-IP limiter protects our own quota.
- **Large result sets.** Server-side pagination (TMDB caps at 500 pages), infinite scroll with an
  IntersectionObserver plus a re-check after each page (so short/filtered pages keep filling), duplicate ids
  removed across pages, `content-visibility: auto` on cards, lazy/async images, and an explicit retry on a
  failed "load more" instead of a silent loop.
- **Navigation without losing context.** Filters live in the URL (`/?q=&genre=&sort=&year=`), so links are
  shareable and Back/Forward work; detail is a route, not a modal; scroll position is restored per history entry
  and the list is still in the query cache. The detail page shows list data instantly while full details load.
- **Layout robustness.** CSS grid `auto-fill`; posters in a fixed 2:3 box with `object-fit: cover` (any source
  ratio), title fallback tile for missing/broken images, 2-line title clamp with `overflow-wrap`, horizontally
  scrollable genre chips, tested from phone width up.
- **Optimistic wishlist** toggles with rollback + toast on failure.

## Assumptions

- Single-user-per-browser wishlist is acceptable (no auth).
- English metadata; adult titles excluded.
- "Highest rated" requires ≥300 votes and "Newest" excludes unreleased titles, otherwise the lists are dominated by noise.

## Known limitations

- **Search + filters:** TMDB's `/search` endpoint ignores sort and genre, so while searching, sort is fixed to
  relevance (UI says so) and genre is applied to each returned page — a page can come back short (the scroller
  keeps loading). Year *is* supported natively.
- Cache is in-process memory: cleared on restart and not shared between instances.
- Wishlist is tied to one browser; clearing site data loses access to it.
- The DOM is not virtualized; after hundreds of pages scrolled memory grows (mitigated by `content-visibility`).
- TMDB integration was written against its documented API; the automated tests cover normalization but hit no
  live TMDB (the sample provider was used for end-to-end runs).
- Sample-mode images come from picsum.photos and need internet access.

## What I'd improve with more time

- Virtualized grid (e.g. TanStack Virtual) and a page cap with "back to top".
- Accounts (or a recoverable share code) so wishlists sync across devices; server-side pagination cursors.
- Redis for the cache and rate limiter; a persisted stale cache; circuit breaker around the upstream.
- Search suggestions/autocomplete; combine search + genre properly via a local search index.
- Component and e2e tests (Vitest/Testing Library, Playwright); ESLint + TypeScript; CI.
- Proper image `srcset`/blurhash placeholders; PWA/offline shell.

## AI usage

Claude (via Claude Code) was used to scaffold the project, write initial implementations of the Express layers,
React hooks/components and tests, and to debug (e.g. a rate-limiter issue where sample posters were counted
against the API limit). The architecture (provider abstraction, cache/stale/dedupe strategy, wishlist model)
and the behaviours listed above were specified as requirements; I reviewed the code and am able to walk
through any part of it.
