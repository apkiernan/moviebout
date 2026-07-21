import { describe, expect, it } from "vitest";
import { assertPlayableLists, type Movie, type MovieList } from "./movies";

// assertPlayableLists runs while the site builds, gating the lists fetched
// from TMDB ($lib/server/tmdb.ts): a bad refresh should fail the build
// before it ships an unplayable list.

function movie(i: number, overrides: Partial<Movie> = {}): Movie {
	return {
		id: 1000 + i,
		title: `Movie ${i}`,
		year: 1950 + i,
		blurb: "A perfectly serviceable film",
		poster: `https://image.tmdb.org/t/p/w500/poster-${i}.jpg`,
		cast: ["Some Actor", "Another Actor"],
		...overrides,
	};
}

function list(id: string, movies = 20): MovieList {
	return {
		id,
		name: `List ${id}`,
		tagline: `Tagline for ${id}`,
		movies: Array.from({ length: movies }, (_, i) => movie(i)),
	};
}

describe("assertPlayableLists", () => {
	it("passes playable lists through", () => {
		const lists = [list("a"), list("b")];
		expect(assertPlayableLists(lists)).toBe(lists);
	});

	it("rejects an empty set of lists", () => {
		expect(() => assertPlayableLists([])).toThrow(/no movie lists/i);
	});

	it("rejects duplicate list ids", () => {
		expect(() => assertPlayableLists([list("a"), list("a")])).toThrow(/duplicate ids/);
	});

	it("rejects a list too small to draw a bracket from", () => {
		expect(() => assertPlayableLists([list("a", 15)])).toThrow(/draws 16/);
	});

	it("rejects duplicate movies within a list", () => {
		const bad = list("a");
		bad.movies[1] = { ...bad.movies[0] };
		expect(() => assertPlayableLists([bad])).toThrow(/duplicate movies/);
	});

	it("rejects malformed movies", () => {
		const noTitle = list("a");
		noTitle.movies[3] = movie(3, { title: "" });
		expect(() => assertPlayableLists([noTitle])).toThrow(/malformed/);

		const badYear = list("b");
		badYear.movies[3] = movie(3, { year: 0 });
		expect(() => assertPlayableLists([badYear])).toThrow(/malformed/);
	});

	it("rejects a movie without a TMDB id — share links reference movies by id", () => {
		const bad = list("a");
		bad.movies[3] = movie(3, { id: undefined });
		expect(() => assertPlayableLists([bad])).toThrow(/TMDB id/);
	});

	it("rejects lists where too many movies are missing posters or cast", () => {
		const bare = list("a");
		for (let i = 0; i < 3; i++) bare.movies[i] = movie(i, { poster: undefined });
		expect(() => assertPlayableLists([bare])).toThrow(/poster/);

		const uncredited = list("b");
		for (let i = 0; i < 3; i++) uncredited.movies[i] = movie(i, { cast: [] });
		expect(() => assertPlayableLists([uncredited])).toThrow(/cast/);
	});

	it("tolerates a few gaps — a movie without a poster still plays", () => {
		const lists = [list("a")];
		lists[0].movies[0] = movie(0, { poster: undefined, cast: undefined });
		expect(() => assertPlayableLists(lists)).not.toThrow();
	});
});
