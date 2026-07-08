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

All lineups live in [`src/data/movies.ts`](src/data/movies.ts) — plain data, no API keys.
Each list needs an `id`, `name`, `tagline`, and at least 16 movies (`title`, `year`, `blurb`).
Add a list there and it appears in the dropdown automatically.

Posters and cast come from TMDB at curation time
([ADR 0001](docs/adr/0001-tmdb-build-time-data.md)), into two companion files keyed by
`` `${title}|${year}` ``: [`src/data/posters.ts`](src/data/posters.ts) and
[`src/data/cast.ts`](src/data/cast.ts). After adding movies, run

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
edits are safe. A movie without a poster or cast entry still works; the ticket just falls
back to text.

Lists can also be _query-defined_ instead of hand-picked: describe them in
[`scripts/tmdb-lists.config.mjs`](scripts/tmdb-lists.config.mjs) (TMDB `discover` params or
a chart like `top_rated`, plus a `limit`) and the same script writes them to
`src/data/generated.ts`. Re-running the script refreshes them.

## Stack

Vite + React + TypeScript. Fonts (Anton, Archivo) are bundled via Fontsource. No backend,
no accounts, no API keys in the bundle — the only runtime network use is loading poster
images from TMDB's CDN. Movie data comes from the TMDB API at curation time; this product
uses the TMDB API but is not endorsed or certified by TMDB.

Installable as a PWA (`public/manifest.webmanifest` + icon set). Social link previews use
`public/og.png`; the `og:` meta tags in `index.html` carry a placeholder domain — swap in
the real one before deploy.
