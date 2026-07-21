# ADR 0003: Shareable results are URL-encoded state, not stored state

- **Status:** Accepted
- **Date:** 2026-07-09
- **Amends:** [ADR 0001](0001-tmdb-build-time-data.md) — one route now renders at
  request time; the runtime contract (no TMDB access, no key) is unchanged

## Context

Finishing a bracket should produce a link that shows the recipient the exact result —
the champion and the full bracket — not just the app's home page. The obvious design is
a database: store the bracket, hand back a short id. But the app deliberately has no
backend for the solo experience (ADR 0001; ADR 0002 confines the future room server to
rooms), and a stored share means writes to rate-limit, retention to define, and links
that die with the storage.

The state is small: a finished bracket is fully determined by the field in seed order
plus one bit per decided bout (`seedRounds` is deterministic, byes included, and the
picks replay in `currentBout` order). For a 16-movie field that is 15 bits of picks;
the field itself is the only real payload.

## Decision

Encode the whole result into the URL: `/share/[code]`, where the code is a compact
binary token (`src/lib/share.ts`) — version byte, list id, field references, pick bits —
serialized as base64url. No storage anywhere.

Field references and drift: lists are regenerated from their TMDB queries on every
build, so positional indices would silently point at the wrong movies after a refresh.
Instead:

- Baked movies travel as **TMDB ids** (now kept on `Movie`), which are permanent. At
  view time the id resolves against the current baked data for poster, blurb, and cast.
- The **champion additionally carries its title/year inline**, so the share's headline
  renders forever, even after its movie rotates out of every list.
- **Custom-card movies** have no id and travel entirely inline as title/year.
- A non-champion movie that has rotated out degrades to an em-dash placeholder in the
  bracket view. Links are shared and viewed within days; lists refresh weekly — this is
  the accepted tail-case.

Rendering: `/share/[code]` is the first route excluded from prerendering — per-share
OG tags (champion title, poster) require request-time SSR, and the Cloudflare worker
already exists (it has served only assets until now). The game pages moved into a
`(game)` route group so their build-time TMDB `load` can never run at request time; the
share route resolves ids against `/lists.json`, a **prerendered endpoint** baked from
the same data, fetched through the worker's own `ASSETS` binding. The runtime still
makes no TMDB call and holds no key.

## Alternatives considered

- **Cloudflare KV/D1 short links.** Pretty URLs and immunity to codec changes, but a
  write endpoint (abuse surface), a retention policy, and links that depend on the
  storage living forever. Nothing here needs it; if the rooms backend (ADR 0002) lands,
  a shortener becomes a trivial add-on and this token becomes its payload.
- **Positional indices into the list** (~25-char tokens). Rejected: a weekly refresh
  silently rewrites every outstanding link to different movies.
- **Everything inline (titles for all 16).** Bulletproof against drift but ~3× the URL
  length; ids already survive drift for everything except removed movies.
- **Client-only rendering of the token** (keep every route prerendered). Loses per-share
  OG tags, which are most of the point of a share link.

## Consequences

- Share links never expire and cost nothing to serve; there is no new state to own.
- The share page is edge-cacheable (tokens are immutable; an hour keeps enrichment
  fresh).
- The token format is versioned (leading byte); a future format bumps it and old links
  keep decoding.
- Anyone can mint a token — it is user input. `decodeShare` treats it as hostile:
  strict bounds, no allocation from unvalidated lengths, null on anything malformed
  (the route 404s).
- `assertPlayableLists` now also fails the build if a baked movie lacks a TMDB id.
