export interface Movie {
	/** TMDB id — stable across data refreshes. Absent on hand-typed custom movies. */
	id?: number;
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

/**
 * Guards the lists materialized from TMDB at build time (ADR 0001) rather
 * than app logic: a bad refresh should fail the build before it ships an
 * unplayable list. Returns the lists so a load can validate-and-pass-through.
 */
export function assertPlayableLists(lists: MovieList[]): MovieList[] {
	if (lists.length === 0) throw new Error("No movie lists were generated");
	const ids = new Set(lists.map((l) => l.id));
	if (ids.size !== lists.length) throw new Error("Movie lists have duplicate ids");

	for (const list of lists) {
		if (!list.name || !list.tagline) throw new Error(`List "${list.id}" is missing name/tagline`);
		if (list.movies.length < 16) {
			throw new Error(`List "${list.id}" has ${list.movies.length} movies — the app draws 16`);
		}
		const keys = new Set(list.movies.map((m) => `${m.title}|${m.year}`));
		if (keys.size !== list.movies.length) throw new Error(`List "${list.id}" has duplicate movies`);
		for (const movie of list.movies) {
			if (!movie.title || !(movie.year > 1900)) {
				throw new Error(`List "${list.id}" has a malformed movie: ${JSON.stringify(movie)}`);
			}
			// Share links reference movies by TMDB id (ADR 0003), so baked movies must carry one.
			if (!(movie.id! > 0)) {
				throw new Error(`List "${list.id}" has a movie without a TMDB id: ${movie.title}`);
			}
		}
	}

	const all = lists.flatMap((l) => l.movies);
	const withPoster = all.filter((m) => m.poster?.startsWith("https://image.tmdb.org/"));
	const withCast = all.filter((m) => (m.cast?.length ?? 0) > 0);
	if (withPoster.length / all.length <= 0.9) {
		throw new Error(`Only ${withPoster.length}/${all.length} movies have a TMDB poster`);
	}
	if (withCast.length / all.length <= 0.9) {
		throw new Error(`Only ${withCast.length}/${all.length} movies have cast`);
	}
	return lists;
}
