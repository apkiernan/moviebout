// Materializes the query-defined lists (ADR 0001) from the TMDB API. This is
// server-only code that runs while the site builds: every route is
// prerendered, so `fetchMovieLists` executes at `vite build` time and the
// finished pages ship with complete movies — title, year, blurb, poster, and
// top-billed cast — baked in. No TMDB key or call ever reaches the client.
//
// The key comes from TMDB_API_KEY (environment or .env at the repo root);
// either a v3 API key or a v4 read access token works, free at
// https://www.themoviedb.org/settings/api.
//
// Every build is a full refresh: lists are regenerated from their queries in
// $lib/server/lists.config.ts, and assertPlayableLists fails the build rather
// than shipping an unplayable list. A movie missing a poster or cast still
// works; the ticket falls back to text.

import { TMDB_API_KEY } from "$env/static/private";
import { assertPlayableLists, type Movie, type MovieList } from "$lib/movies";
import { LIST_DEFS, type ListDef } from "./lists.config";
import { weightedRating } from "./rank";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const DELAY_MS = 25;

// In dev, refetching ~500 movies on every server restart would make the first
// page load crawl, so responses land in a cache file under .svelte-kit
// (delete it to force a refresh). The branch is compiled out of production
// builds — `vite build` always fetches fresh. The version suffix busts caches
// written before a shape change (v2: movies carry TMDB ids).
const DEV_CACHE = ".svelte-kit/tmdb-dev-cache-v2.json";

const isV4Token = TMDB_API_KEY.startsWith("eyJ");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TmdbMovieResult {
	id: number;
	title?: string;
	release_date?: string;
	overview?: string;
	poster_path?: string | null;
	vote_average?: number;
	vote_count?: number;
}

async function tmdb(
	path: string,
	params: Record<string, string | number | boolean> = {},
): Promise<any> {
	const url = new URL(`https://api.themoviedb.org/3${path}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
	if (!isV4Token) url.searchParams.set("api_key", TMDB_API_KEY);
	const init = isV4Token ? { headers: { Authorization: `Bearer ${TMDB_API_KEY}` } } : undefined;
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

/** First sentence of a TMDB overview, trimmed toward a marquee-blurb voice. */
function blurbFrom(overview = ""): string {
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

let genresByName: Map<string, number> | undefined;
async function resolveGenres(value: string | number): Promise<string | number> {
	if (/^[\d,|]+$/.test(String(value))) return value;
	genresByName ??= new Map(
		(await tmdb("/genre/movie/list")).genres.map((g: { name: string; id: number }) => [
			g.name.toLowerCase(),
			g.id,
		]),
	);
	return String(value)
		.split(/([|,])/)
		.map((part) =>
			part === "," || part === "|"
				? part
				: String(genresByName!.get(part.trim().toLowerCase()) ?? part),
		)
		.join("");
}

type FetchedMovie = Movie & { id: number };
type FetchedList = Omit<MovieList, "movies"> & { movies: FetchedMovie[] };

/** Pulls result pages from `path` until `wanted` usable rows or page 10. */
async function fetchPages(
	path: string,
	params: Record<string, string | number | boolean>,
	wanted: number,
): Promise<TmdbMovieResult[]> {
	const results: TmdbMovieResult[] = [];
	for (let page = 1; results.length < wanted && page <= 10; page++) {
		const body = await tmdb(path, { ...params, page });
		results.push(
			...(body.results ?? []).filter((r: TmdbMovieResult) => r.release_date && r.title),
		);
		if (page >= body.total_pages) break;
		await sleep(DELAY_MS);
	}
	return results;
}

async function generateList(def: ListDef): Promise<FetchedList> {
	const limit = def.limit ?? 24;
	const params = { ...def.discover };
	if (params.with_genres) params.with_genres = await resolveGenres(params.with_genres);
	const discoverParams = { include_adult: false, "vote_count.gte": 50, ...params };

	let results: TmdbMovieResult[];
	if (def.chart) {
		results = await fetchPages(`/movie/${def.chart}`, {}, limit);
	} else if (params.sort_by === "weighted_rating.desc") {
		// TMDB can't sort by the weighted rating, so fetch a candidate pool and
		// rank it here. Two complementary sorts feed the pool: by-rating catches
		// acclaimed films the vote-count cutoff would miss, by-votes catches
		// famous films whose raw rating sits below the rating cutoff. Merged,
		// the weighted rating arbitrates.
		const wanted = limit * 2;
		const acclaimed = await fetchPages(
			"/discover/movie",
			{ ...discoverParams, sort_by: "vote_average.desc" },
			wanted,
		);
		const famous = await fetchPages(
			"/discover/movie",
			{ ...discoverParams, sort_by: "vote_count.desc" },
			wanted,
		);
		const pool = new Map([...acclaimed, ...famous].map((r) => [r.id, r]));
		results = [...pool.values()].sort((a, b) => weightedRating(b) - weightedRating(a));
	} else {
		results = await fetchPages("/discover/movie", discoverParams, limit);
	}

	const movies = results.slice(0, limit).map((r) => ({
		id: r.id,
		title: r.title!,
		year: Number(r.release_date!.slice(0, 4)),
		blurb: blurbFrom(r.overview),
		poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
	}));
	return { id: def.id, name: def.name, tagline: def.tagline, movies };
}

async function fetchAllLists(): Promise<MovieList[]> {
	console.log(`Generating ${LIST_DEFS.length} query-defined list(s) from TMDB...`);
	const lists: FetchedList[] = [];
	for (const def of LIST_DEFS) {
		const list = await generateList(def);
		lists.push(list);
		console.log(`  ${list.id}: ${list.movies.length} movies`);
	}

	// The same movie can appear in several lists — fetch its cast once.
	const byId = new Map<number, FetchedMovie[]>();
	for (const list of lists) {
		for (const mv of list.movies) {
			if (!byId.has(mv.id)) byId.set(mv.id, []);
			byId.get(mv.id)!.push(mv);
		}
	}

	console.log(`Fetching cast for ${byId.size} unique movies...`);
	let done = 0;
	for (const copies of byId.values()) {
		done++;
		const credits = await tmdb(`/movie/${copies[0].id}/credits`);
		const cast = (credits.cast ?? []).slice(0, 3).map((c: { name: string }) => c.name);
		for (const mv of copies) mv.cast = cast;
		if (done % 100 === 0) console.log(`  [${done}/${byId.size}]`);
		await sleep(DELAY_MS);
	}

	const all = lists.flatMap((l) => l.movies);
	const noPosterOrCast = all.filter((mv) => !mv.poster || !mv.cast?.length);
	console.log(`Done. ${lists.length} lists, ${byId.size} unique movies.`);
	for (const mv of noPosterOrCast) console.log(`  missing poster/cast: ${mv.title}|${mv.year}`);
	return lists;
}

async function fetchWithDevCache(): Promise<MovieList[]> {
	if (import.meta.env.DEV) {
		const fs = await import("node:fs");
		try {
			return JSON.parse(fs.readFileSync(DEV_CACHE, "utf8")) as MovieList[];
		} catch {
			// no cache yet — fetch, then write one
		}
		const lists = await fetchAllLists();
		fs.writeFileSync(DEV_CACHE, JSON.stringify(lists));
		console.log(`Cached TMDB data at ${DEV_CACHE} — delete it to force a refresh.`);
		return lists;
	}
	return fetchAllLists();
}

// Memoized: the prerenderer runs the layout load once per route, but the
// lists should be fetched once per build (and once per dev-server run).
let listsPromise: Promise<MovieList[]> | undefined;

export function fetchMovieLists(): Promise<MovieList[]> {
	listsPromise ??= fetchWithDevCache().then(assertPlayableLists);
	return listsPromise;
}
