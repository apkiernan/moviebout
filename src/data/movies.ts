import { GENERATED_LISTS } from "./generated";

export interface Movie {
	title: string;
	year: number;
	blurb: string;
	poster?: string;
	cast?: string[];
}

export interface MovieList {
	id: string;
	name: string;
	tagline: string;
	movies: Movie[];
}

// Every lineup is grounded in a TMDB chart or discover query (ADR 0001),
// defined in scripts/tmdb-lists.config.mjs and materialized — posters and
// cast inline — into generated.ts by scripts/fetch-tmdb.mjs. Lists are only
// as fresh as the last script run + deploy.
export const MOVIE_LISTS: MovieList[] = GENERATED_LISTS;
