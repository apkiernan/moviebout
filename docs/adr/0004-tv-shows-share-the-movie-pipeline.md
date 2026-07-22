# ADR 0004: TV shows share the movie pipeline

- **Status:** Accepted
- **Date:** 2026-07-22
- **Amends:** [ADR 0001](0001-tmdb-build-time-data.md) — lists may now be TV
  queries; [ADR 0003](0003-shareable-bracket-urls.md) — share refs carry a
  media bit

## Context

The app should offer TV show and limited-series brackets alongside movies. TMDB
itself covers TV — same API, same key, same image CDN — but as a parallel world:
different paths (`/discover/tv`, `/tv/{id}/aggregate_credits`), different field
names (`name`/`first_air_date` for `title`/`release_date`), a different genre
taxonomy (no Horror/Romance/Thriller; combined "Sci-Fi & Fantasy"), vote counts
roughly an order of magnitude lower, and — critically — **an id namespace minted
independently of movies**, so a bare TMDB id no longer identifies a title.

The bracket, game state, and ticket UI never cared that their contenders were
movies: they render title, year, blurb, poster, cast. Only the data layer and
the id-keyed lookups know what a movie is.

## Decision

One pipeline, one `Movie` shape, a `media: "movie" | "tv"` tag where TMDB's two
worlds diverge — **absent means "movie"**, so old saves, custom cards, and baked
movie payloads stay byte-identical.

- **Fetching** (`$lib/server/tmdb.ts`): list defs carry `media`; everything
  TV-specific is normalized at the fetch edge (`name` → title, first-air year →
  year, `aggregate_credits` → top-billed cast so long-running shows bill their
  actual leads). Downstream code stays media-blind except where ids are keys:
  the cast-dedup map is keyed `media:id`.
- **Ranking** (`$lib/server/rank.ts`): the Bayesian prior is now per-media —
  10k votes for movies, 2k for TV. Under the movie prior every show shrinks to
  the mean and the order degenerates to raw vote count.
- **Curation** (`$lib/server/lists.config.ts`): `with_type: "2|4"` (miniseries
  or scripted) plays the hygiene role the runtime floor plays for movies,
  keeping talk/news/reality out. TV genre lanes exclude animation — anime's
  engaged-fan vote counts would otherwise top every lane — and animation gets
  its own list, exactly as the pre-1980 canon got "classics". `with_type: 2`
  alone defines the Limited Series list.
- **Share tokens** (`$lib/share.ts`): each ref's flags byte gains a TV bit
  (bit 4) and ids resolve in media-scoped maps, so a TV ref can never alias a
  movie sharing its number. Still VERSION 1: pre-TV tokens never set the bit
  and decode unchanged; a pre-TV decoder rejects TV-bearing tokens as malformed
  (`flags > 3`) rather than misresolving them — fail-closed in both directions.
- **UI**: the lineup picker groups Movies / TV Shows; copy says "contenders"
  and "titles" where a lineup's medium isn't known. Custom cards stay untyped —
  they are inline title/year and never resolve by id.

## Alternatives considered

- **A separate `TvShow` type and parallel list plumbing.** Rejected: the
  bracket is medium-agnostic by construction; a second type would duplicate
  every seam for one field's worth of difference.
- **A dedicated TV data source (TheTVDB, TVmaze).** Rejected: TVDB gates its
  API behind a license, TVmaze is episode-schedule-oriented with no crowd
  ratings, and either would mean a second key, rate-limit regime, and image
  host for data TMDB already has.
- **A version bump for TV share tokens.** Unnecessary: the flags byte had
  spare bits and the old decoder's strictness (reject unknown bits) already
  gives the right failure mode.
- **Mixed-media lists** ("Heat vs. The Wire"). Deferred, but nothing forbids
  it: `media` travels per-title everywhere, so a crossover list is config-only.

## Consequences

- Adding a TV list is one `LIST_DEFS` entry with `media: "tv"`, same as movies.
- `lists.json` grows by the TV lists; movie entries are unchanged, so nothing
  about ADR 0003's resolution path moves.
- The dev cache bumped to v3 (movies carry `media`).
- TV genre lists inherit TMDB's tagging quirks (a broad "comedy" lane); the
  vote floor and weighted rating keep the top of each card recognizable, which
  is all a 16-draw needs.
