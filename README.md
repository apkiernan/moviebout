# What to Watch

The date-night movie bracket. Pick a lineup, draw 16 random movies, and vote head-to-head —
March Madness style — until one movie is left. That's what you're watching.

## Run it

```sh
npm install
npm run dev
```

Then open the printed localhost URL. `npm run build` produces a static site in `dist/` that can
be dropped on any static host.

## How it plays

1. **Home** — choose a lineup from the dropdown (Best of All Time, genres, '90s, feel-good…),
   or build your own card: paste in 16+ movies, one per line, and draw from those instead
   (saved to `localStorage`).
2. **The Field of 16** — 16 movies drawn at random; shuffle again if the draw looks weak.
3. **Bouts** — each matchup shows two ticket stubs. Tap the one you'd rather watch
   (or use ← / → arrow keys). Can't agree? Flip the coin.
4. **Champion** — the winner goes up on the marquee. Share the result (native share sheet,
   or copied to the clipboard), jump to JustWatch to see where it's streaming, see the full
   bracket, undo the final, run it back with a fresh draw, or pick a new lineup.

Progress is saved to `localStorage`, so an in-progress bracket survives a page refresh and can
be resumed from the home screen.

## Editing the movie lists

Every lineup is _query-defined_: described in
[`scripts/tmdb-lists.config.mjs`](scripts/tmdb-lists.config.mjs) as a TMDB query (`discover`
params or a chart like `top_rated`, plus a `limit`) and materialized into
[`src/data/generated.ts`](src/data/generated.ts) by the fetch script — no hand-picked
lineups. Each list needs an `id`, `name`, `tagline`, and a query that yields at least 16
movies (the app draws 16 per bracket). Add an entry, re-run the script, and the list
appears in the dropdown; re-running also refreshes existing lists against TMDB's current
ratings, so lists are only as fresh as the last run + deploy.

Posters and cast come from TMDB at the same time
([ADR 0001](docs/adr/0001-tmdb-build-time-data.md)), into two companion files keyed by
`` `${title}|${year}` ``: [`src/data/posters.ts`](src/data/posters.ts) and
[`src/data/cast.ts`](src/data/cast.ts). After changing the config, run

```sh
TMDB_API_KEY=... node scripts/fetch-tmdb.mjs
```

with a free key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
(either the v3 key or the v4 read access token works). For local development, drop the key
in a `.env` file at the repo root instead (gitignored):

```sh
echo 'TMDB_API_KEY=...' > .env
node scripts/fetch-tmdb.mjs
```

Already-fetched movies are skipped,
so re-runs only fetch what's new, and existing cast entries are never overwritten — hand
edits to posters/cast are safe. A movie without a poster or cast entry still works; the
ticket just falls back to text.

## Stack

Vite + React + TypeScript. Fonts (Anton, Archivo) are bundled via Fontsource. No backend,
no accounts, no API keys in the bundle — the only runtime network use is loading poster
images from TMDB's CDN. Movie data comes from the TMDB API at curation time; this product
uses the TMDB API but is not endorsed or certified by TMDB.

Installable as a PWA (`public/manifest.webmanifest` + icon set). Social link previews use
`public/og.png`; the `og:` meta tags in `index.html` carry a placeholder domain — swap in
the real one before deploy.
