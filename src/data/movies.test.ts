import { describe, expect, it } from "vitest";
import { MOVIE_LISTS } from "./movies";

// Guards the generated data (scripts/fetch-tmdb.mjs) rather than app logic:
// a bad refresh should fail CI before it ships an unplayable list.
describe("generated movie lists", () => {
	it("has lists with unique ids and enough movies to draw a bracket", () => {
		expect(MOVIE_LISTS.length).toBeGreaterThan(0);
		const ids = MOVIE_LISTS.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const list of MOVIE_LISTS) {
			expect(list.name).toBeTruthy();
			expect(list.tagline).toBeTruthy();
			expect(list.movies.length).toBeGreaterThanOrEqual(16);
		}
	});

	it("has well-formed movies with no duplicates within a list", () => {
		for (const list of MOVIE_LISTS) {
			const keys = list.movies.map((m) => `${m.title}|${m.year}`);
			expect(new Set(keys).size).toBe(keys.length);
			for (const movie of list.movies) {
				expect(movie.title).toBeTruthy();
				expect(movie.year).toBeGreaterThan(1900);
			}
		}
	});

	it("has posters and cast for nearly every movie", () => {
		const all = MOVIE_LISTS.flatMap((l) => l.movies);
		const withPoster = all.filter((m) => m.poster?.startsWith("https://image.tmdb.org/"));
		const withCast = all.filter((m) => (m.cast?.length ?? 0) > 0);
		expect(withPoster.length / all.length).toBeGreaterThan(0.9);
		expect(withCast.length / all.length).toBeGreaterThan(0.9);
	});
});
