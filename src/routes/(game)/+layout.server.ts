import { fetchMovieLists } from "$lib/server/tmdb";
import type { LayoutServerLoad } from "./$types";

// Every game route is prerendered: this load runs while the site builds, so
// the TMDB-defined lineups are baked into the pages (ADR 0001) and the
// deployed site makes no TMDB API calls — posters load from TMDB's CDN,
// nothing else. The share route (ADR 0003) renders at request time and lives
// outside this group precisely so it can never trigger this load.
export const prerender = true;

export const load: LayoutServerLoad = async () => {
	return { lists: await fetchMovieLists() };
};
