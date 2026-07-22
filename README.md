# Moviebout

The date-night bracket for movies and TV shows. Pick a lineup, draw 16 random titles, and
vote head-to-head — March Madness style — until one is left. That's what you're watching.

## Run it

```sh
echo 'TMDB_API_KEY=...' > .env   # free key from themoviedb.org/settings/api
npm install
npm run dev
```

Then open the printed localhost URL. The movie and TV lists come from the TMDB API when the
site builds, so dev needs the key too (either the v3 key or the v4 read access token works).
The first dev-server run fetches everything once and caches it at
`.svelte-kit/tmdb-dev-cache-v3.json` — delete that file to force a refresh.

`npm test` runs the vitest suite covering the bracket logic, the custom-card parser, the
list validation, and a server-side render of the home page. `npm run check` type-checks
with svelte-check, and `npm run build` prerenders the whole site for Cloudflare Workers
(`npm run deploy` builds and ships it with wrangler).

## How it plays

1. **Home** (`/`) — choose a lineup from the dropdown: movie cards (Best of All Time,
   genres, '90s, feel-good…) or TV cards (Best TV of All Time, Limited Series, genres…).
   Or build your own card at `/builder`: paste in 16+ movies or shows, one per line, and
   draw from those instead (saved to `localStorage`).
2. **The Field of 16** (`/field`) — 16 titles drawn at random; shuffle again if the draw
   looks weak.
3. **Bouts** (`/play`) — each matchup shows two ticket stubs. Tap the one you'd rather
   watch (or use ← / → arrow keys). Can't agree? Flip the coin.
4. **Champion** (`/champion`) — the winner goes up on the marquee. Share the result
   (native share sheet, or copied to the clipboard), jump to JustWatch to see where it's
   streaming, see the full bracket, undo the final, run it back with a fresh draw, or pick
   a new lineup.

Progress is saved to `localStorage`, so an in-progress bracket survives a page refresh —
reloading `/play` picks up where you left off, and the home screen offers a resume.

## Editing the lists

Every lineup is _query-defined_: described in
[`src/lib/server/lists.config.ts`](src/lib/server/lists.config.ts) as a TMDB query
(`discover` params or a chart like `top_rated`, plus a `limit`) — no hand-picked lineups.
Each list needs an `id`, `name`, `tagline`, and a query that yields at least 16 titles
(the app draws 16 per bracket). Set `media: "tv"` for a TV lineup
([ADR 0004](docs/adr/0004-tv-shows-share-the-movie-pipeline.md)) — TV uses different
discover params, genre names, and vote floors than movies; the config's comments cover
the differences. Add an entry and the list appears in the dropdown on the next build.

The queries are materialized by [`src/lib/server/tmdb.ts`](src/lib/server/tmdb.ts) while
the site builds ([ADR 0001](docs/adr/0001-tmdb-build-time-data.md)): the whole app is
prerendered, so the layout's server `load` runs at build time, fetches every list with
posters and top-billed cast inline, and bakes complete titles into the pages. Every build
is a full refresh against TMDB's current ratings, and `assertPlayableLists` fails the
build rather than shipping an unplayable list. A title without a poster or cast still
works; the ticket falls back to text.

## Stack

SvelteKit + Svelte 5 (runes) + TypeScript, deployed to Cloudflare Workers with
`@sveltejs/adapter-cloudflare`. Fonts (Anton, Archivo) are bundled via Fontsource. No
backend, no accounts, no API keys in the client bundle — TMDB is only called at build
time, and the deployed site's only runtime network use is loading poster images from
TMDB's CDN. This product uses the TMDB API but is not endorsed or certified by TMDB.

Game state lives in a runes-based store ([`src/lib/game.svelte.ts`](src/lib/game.svelte.ts))
shared across the routes; the bracket itself is pure logic in
[`src/lib/bracket.ts`](src/lib/bracket.ts).

Installable as a PWA (`static/manifest.webmanifest` + icon set). Social link previews use
`static/og.png`; the `og:` meta tags in `src/app.html` carry a placeholder domain — swap
in the real one before deploy.

CI (GitHub Actions) lints, type-checks, tests, and builds every push and PR, and every
push to `main` that passes those checks deploys to Cloudflare Workers automatically
(`.github/workflows/ci.yml`). A weekly workflow redeploys on a schedule so the lineups
track TMDB's current ratings (`.github/workflows/refresh-data.yml`).

Both need two repository secrets (Settings → Secrets and variables → Actions):

- `TMDB_API_KEY` — free key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api);
  the build fetches all movie and TV data from TMDB.
- `CLOUDFLARE_API_TOKEN` — create at dash.cloudflare.com → My Profile → API Tokens using
  the **Edit Cloudflare Workers** template (covers the Workers-script upload and the
  custom-domain routes in `wrangler.jsonc`). If the token can see more than one Cloudflare
  account, also add a `CLOUDFLARE_ACCOUNT_ID` secret and pass it the same way, or wrangler
  can't pick an account non-interactively.
