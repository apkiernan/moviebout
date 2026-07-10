// Fetches movie data from the TMDB API at curation time (ADR 0001) and writes
// src/data/generated.ts: every list in scripts/tmdb-lists.config.mjs materialized
// as complete movies — title, year, blurb, poster, and top-billed cast inline.
//
//   TMDB_API_KEY=... node scripts/fetch-tmdb.mjs
//
// Accepts a v3 API key or a v4 read access token (free at
// https://www.themoviedb.org/settings/api). The key can also live in a .env file
// at the repo root (gitignored); a variable set in the shell wins.
//
// Every run is a full refresh: lists are regenerated from their queries and
// posters/cast are re-fetched, so generated.ts is purely derived output — don't
// edit it by hand. A movie missing a poster or cast still works; the ticket
// falls back to text. Misses are listed at the end of a run.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_TS = join(root, "src", "data", "generated.ts");

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const DELAY_MS = 25;

try {
	process.loadEnvFile(join(root, ".env"));
} catch {
	// no .env file — rely on the shell environment
}

const TOKEN = process.env.TMDB_API_KEY;
if (!TOKEN) {
	console.error(
		"TMDB_API_KEY is not set (in the environment or a .env file at the repo root).\n" +
			"Get a free key at https://www.themoviedb.org/settings/api",
	);
	process.exit(1);
}
const isV4Token = TOKEN.startsWith("eyJ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}) {
	const url = new URL(`https://api.themoviedb.org/3${path}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
	if (!isV4Token) url.searchParams.set("api_key", TOKEN);
	const init = isV4Token ? { headers: { Authorization: `Bearer ${TOKEN}` } } : undefined;
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(url, init);
		if (res.ok) return res.json();
		if ((res.status === 429 || res.status >= 500) && attempt < 3) {
			const wait = Number(res.headers.get("retry-after")) * 1000 || 2 ** attempt * 1000;
			console.log(`  TMDB ${res.status}, backing off ${wait / 1000}s...`);
			await sleep(wait);
			continue;
		}
		throw new Error(`TMDB ${res.status} on ${path}`);
	}
}

// ---------------------------------------------------------------------------
// Lists defined as TMDB queries

/** First sentence of a TMDB overview, trimmed toward a marquee-blurb voice. */
function blurbFrom(overview = "") {
	const text = overview.trim();
	// A period after an abbreviation or an initial doesn't end the sentence
	// ("Dr. Frankenstein", "Capt. Reyes", "J. K. Rowling").
	const abbrev = /\b(?:Mr|Mrs|Ms|Dr|St|Sgt|Capt|Lt|Col|Gen|Prof|Jr|Sr|vs|[A-Z])\.$/;
	let first = text;
	for (const match of text.matchAll(/[.!?](?=\s|$)/g)) {
		const candidate = text.slice(0, match.index + 1);
		if (abbrev.test(candidate)) continue;
		first = candidate;
		break;
	}
	if (first.length > 140) first = first.slice(0, 110).replace(/\s+\S*$/, "") + "…";
	return first.replace(/\.$/, "");
}

let genresByName;
async function resolveGenres(value) {
	if (/^[\d,|]+$/.test(String(value))) return value;
	genresByName ??= new Map(
		(await tmdb("/genre/movie/list")).genres.map((g) => [g.name.toLowerCase(), g.id]),
	);
	return String(value)
		.split(/([|,])/)
		.map((part) =>
			part === "," || part === "|" ? part : (genresByName.get(part.trim().toLowerCase()) ?? part),
		)
		.join("");
}

async function generateList(def) {
	const limit = def.limit ?? 24;
	const params = { ...def.discover };
	if (params.with_genres) params.with_genres = await resolveGenres(params.with_genres);
	const results = [];
	for (let page = 1; results.length < limit && page <= 10; page++) {
		const body = def.chart
			? await tmdb(`/movie/${def.chart}`, { page })
			: await tmdb("/discover/movie", {
					include_adult: false,
					"vote_count.gte": 50,
					...params,
					page,
				});
		results.push(...(body.results ?? []).filter((r) => r.release_date && r.title));
		if (page >= body.total_pages) break;
		await sleep(DELAY_MS);
	}
	const movies = results.slice(0, limit).map((r) => ({
		title: r.title,
		year: Number(r.release_date.slice(0, 4)),
		blurb: blurbFrom(r.overview),
		poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
		tmdbId: r.id,
	}));
	if (movies.length < 16) {
		console.warn(`WARNING: list "${def.id}" has only ${movies.length} movies — the app draws 16.`);
	}
	return { id: def.id, name: def.name, tagline: def.tagline, movies };
}

// ---------------------------------------------------------------------------
// Output

function writeGenerated(lists) {
	const renderMovie = (mv) => {
		const fields = [
			`title: ${JSON.stringify(mv.title)}`,
			`year: ${mv.year}`,
			`blurb: ${JSON.stringify(mv.blurb)}`,
		];
		if (mv.poster) fields.push(`poster: ${JSON.stringify(mv.poster)}`);
		if (mv.cast?.length) fields.push(`cast: ${JSON.stringify(mv.cast)}`);
		return `\t\t\t{ ${fields.join(", ")} },`;
	};
	const renderList = (list) => `\t{
\t\tid: ${JSON.stringify(list.id)},
\t\tname: ${JSON.stringify(list.name)},
\t\ttagline: ${JSON.stringify(list.tagline)},
\t\tmovies: [
${list.movies.map(renderMovie).join("\n")}
\t\t],
\t},`;
	writeFileSync(
		GENERATED_TS,
		`// Generated by scripts/fetch-tmdb.mjs from scripts/tmdb-lists.config.mjs — do not
// edit; re-run the script to refresh. Every movie is complete: posters and
// top-billed cast are fetched inline at generation time.
import type { MovieList } from "./movies";

export const GENERATED_LISTS: MovieList[] = [
${lists.map(renderList).join("\n")}
];
`,
	);
}

// ---------------------------------------------------------------------------
// Run

const config = (await import("./tmdb-lists.config.mjs")).default;
if (!config?.length) {
	console.error("scripts/tmdb-lists.config.mjs has no lists.");
	process.exit(1);
}

console.log(`Generating ${config.length} query-defined list(s)...`);
const lists = [];
for (const def of config) {
	const list = await generateList(def);
	lists.push(list);
	console.log(`  ${list.id}: ${list.movies.length} movies`);
}

// The same movie can appear in several lists — fetch its cast once.
const byKey = new Map();
for (const list of lists) {
	for (const mv of list.movies) {
		const key = `${mv.title}|${mv.year}`;
		if (!byKey.has(key)) byKey.set(key, []);
		byKey.get(key).push(mv);
	}
}

console.log(`Fetching cast for ${byKey.size} unique movies...`);
let done = 0;
for (const copies of byKey.values()) {
	done++;
	const credits = await tmdb(`/movie/${copies[0].tmdbId}/credits`);
	const cast = (credits.cast ?? []).slice(0, 3).map((c) => c.name);
	for (const mv of copies) mv.cast = cast;
	if (done % 50 === 0) console.log(`  [${done}/${byKey.size}]`);
	await sleep(DELAY_MS);
}

for (const list of lists) {
	list.movies = list.movies.map(({ tmdbId: _, ...mv }) => mv);
}
writeGenerated(lists);

const all = lists.flatMap((l) => l.movies);
const noPoster = all.filter((mv) => !mv.poster);
const noCast = all.filter((mv) => !mv.cast?.length);
console.log(
	`\nDone. ${lists.length} lists, ${byKey.size} unique movies, ` +
		`${noPoster.length} missing a poster, ${noCast.length} missing cast.`,
);
for (const mv of new Set([...noPoster, ...noCast])) {
	console.log(`  - ${mv.title}|${mv.year}`);
}
