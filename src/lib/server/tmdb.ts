// Materializes the query-defined lists (ADR 0001) from the TMDB API. This is
// server-only code that runs while the site builds: every route is
// prerendered, so `fetchMovieLists` executes at `vite build` time and the
// finished pages ship with complete titles — name, year, blurb, poster, and
// top-billed cast — baked in. No TMDB key or call ever reaches the client.
//
// Movie and TV lists (ADR 0004) come from the same API under different paths
// and field names; everything TV-specific is normalized here into the one
// `Movie` shape (`name` → title, `first_air_date` → year, aggregate credits
// → cast), so nothing downstream branches on media except where TMDB ids —
// which movie and TV mint independently — are used as keys.
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
import {
	assertPlayableLists,
	mediaOf,
	type MediaType,
	type Movie,
	type MovieList,
} from "$lib/movies";
import { LIST_DEFS, type ListDef } from "./lists.config";
import { PRIOR_VOTES, weightedRating } from "./rank";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const DELAY_MS = 25;

// In dev, refetching ~500 titles on every server restart would make the first
// page load crawl, so responses land in a cache file under .svelte-kit
// (delete it to force a refresh). The branch is compiled out of production
// builds — `vite build` always fetches fresh. The version suffix busts caches
// written before a shape change (v3: TV lists, movies carry `media`).
const DEV_CACHE = ".svelte-kit/tmdb-dev-cache-v3.json";

const isV4Token = TMDB_API_KEY.startsWith("eyJ");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One result row from /discover, /movie/* or /tv/* charts. Movies carry
// title/release_date, TV carries name/first_air_date; titleOf/dateOf unify.
interface TmdbResult {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	overview?: string;
	poster_path?: string | null;
	vote_average?: number;
	vote_count?: number;
}

const titleOf = (r: TmdbResult) => r.title ?? r.name;
const dateOf = (r: TmdbResult) => r.release_date ?? r.first_air_date;

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

// Movies and TV have separate genre taxonomies (and separate ids for shared
// names like "animation"), so each media type gets its own name → id map.
const genreMaps = new Map<MediaType, Map<string, number>>();
async function resolveGenres(media: MediaType, value: string | number): Promise<string | number> {
	if (/^[\d,|]+$/.test(String(value))) return value;
	let byName = genreMaps.get(media);
	if (!byName) {
		byName = new Map(
			(await tmdb(`/genre/${media}/list`)).genres.map((g: { name: string; id: number }) => [
				g.name.toLowerCase(),
				g.id,
			]),
		);
		genreMaps.set(media, byName);
	}
	return String(value)
		.split(/([|,])/)
		.map((part) =>
			part === "," || part === "|" ? part : String(byName.get(part.trim().toLowerCase()) ?? part),
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
): Promise<TmdbResult[]> {
	const results: TmdbResult[] = [];
	for (let page = 1; results.length < wanted && page <= 10; page++) {
		const body = await tmdb(path, { ...params, page });
		results.push(...(body.results ?? []).filter((r: TmdbResult) => dateOf(r) && titleOf(r)));
		if (page >= body.total_pages) break;
		await sleep(DELAY_MS);
	}
	return results;
}

async function generateList(def: ListDef): Promise<FetchedList> {
	const media = def.media ?? "movie";
	const limit = def.limit ?? 24;
	const params = { ...def.discover };
	if (params.with_genres) params.with_genres = await resolveGenres(media, params.with_genres);
	if (params.without_genres) {
		params.without_genres = await resolveGenres(media, params.without_genres);
	}
	const discoverParams = { include_adult: false, "vote_count.gte": 50, ...params };

	let results: TmdbResult[];
	if (def.chart) {
		results = await fetchPages(`/${media}/${def.chart}`, {}, limit);
	} else if (params.sort_by === "weighted_rating.desc") {
		// TMDB can't sort by the weighted rating, so fetch a candidate pool and
		// rank it here. Two complementary sorts feed the pool: by-rating catches
		// acclaimed titles the vote-count cutoff would miss, by-votes catches
		// famous titles whose raw rating sits below the rating cutoff. Merged,
		// the weighted rating arbitrates.
		const wanted = limit * 2;
		const acclaimed = await fetchPages(
			`/discover/${media}`,
			{ ...discoverParams, sort_by: "vote_average.desc" },
			wanted,
		);
		const famous = await fetchPages(
			`/discover/${media}`,
			{ ...discoverParams, sort_by: "vote_count.desc" },
			wanted,
		);
		const pool = new Map([...acclaimed, ...famous].map((r) => [r.id, r]));
		const prior = PRIOR_VOTES[media];
		results = [...pool.values()].sort(
			(a, b) => weightedRating(b, prior) - weightedRating(a, prior),
		);
	} else {
		results = await fetchPages(`/discover/${media}`, discoverParams, limit);
	}

	// `media` is only written for TV, keeping "absent means movie" true in the
	// baked data and old movie payloads byte-identical.
	const mediaTag = media === "tv" ? { media } : undefined;
	const movies = results.slice(0, limit).map((r) => ({
		id: r.id,
		...mediaTag,
		title: titleOf(r)!,
		year: Number(dateOf(r)!.slice(0, 4)),
		blurb: blurbFrom(r.overview),
		poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
	}));
	return { id: def.id, ...mediaTag, name: def.name, tagline: def.tagline, movies };
}

async function fetchAllLists(): Promise<MovieList[]> {
	console.log(`Generating ${LIST_DEFS.length} query-defined list(s) from TMDB...`);
	const lists: FetchedList[] = [];
	for (const def of LIST_DEFS) {
		const list = await generateList(def);
		lists.push(list);
		console.log(`  ${list.id}: ${list.movies.length} movies`);
	}

	// The same title can appear in several lists — fetch its cast once. Keyed
	// by media AND id: TMDB movie and TV ids are separate namespaces, so a
	// bare id could alias a movie with an unrelated show.
	const byId = new Map<string, FetchedMovie[]>();
	for (const list of lists) {
		for (const mv of list.movies) {
			const key = `${mediaOf(mv)}:${mv.id}`;
			if (!byId.has(key)) byId.set(key, []);
			byId.get(key)!.push(mv);
		}
	}

	console.log(`Fetching cast for ${byId.size} unique titles...`);
	let done = 0;
	for (const copies of byId.values()) {
		done++;
		// aggregate_credits sums a show's roles across seasons, so long-running
		// shows bill their actual leads instead of the latest season's.
		const creditsPath =
			mediaOf(copies[0]) === "tv"
				? `/tv/${copies[0].id}/aggregate_credits`
				: `/movie/${copies[0].id}/credits`;
		const credits = await tmdb(creditsPath);
		const cast = (credits.cast ?? []).slice(0, 3).map((c: { name: string }) => c.name);
		for (const mv of copies) mv.cast = cast;
		if (done % 100 === 0) console.log(`  [${done}/${byId.size}]`);
		await sleep(DELAY_MS);
	}

	const all = lists.flatMap((l) => l.movies);
	const noPosterOrCast = all.filter((mv) => !mv.poster || !mv.cast?.length);
	console.log(`Done. ${lists.length} lists, ${byId.size} unique titles.`);
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
