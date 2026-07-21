import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movie } from "./movies";
import { loadCustomMovies, parseCard, saveCustomMovies, serializeCard } from "./customCard";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value),
	removeItem: (key: string) => void store.delete(key),
});

beforeEach(() => store.clear());

describe("parseCard", () => {
	it("parses 'Title (Year)' lines", () => {
		expect(parseCard("Heat (1995)")).toEqual([{ title: "Heat", year: 1995, blurb: "" }]);
	});

	it("parses 'Title, Year' lines", () => {
		expect(parseCard("Heat, 1995")).toEqual([{ title: "Heat", year: 1995, blurb: "" }]);
	});

	it("parses a bare title with year 0", () => {
		expect(parseCard("Heat")).toEqual([{ title: "Heat", year: 0, blurb: "" }]);
	});

	it("keeps commas and digits that are not a trailing year", () => {
		expect(parseCard("I, Tonya")).toEqual([{ title: "I, Tonya", year: 0, blurb: "" }]);
		expect(parseCard("Blade Runner 2049")).toEqual([
			{ title: "Blade Runner 2049", year: 0, blurb: "" },
		]);
		expect(parseCard("Hello, Dolly! (1969)")).toEqual([
			{ title: "Hello, Dolly!", year: 1969, blurb: "" },
		]);
	});

	it("skips blank lines and trims whitespace", () => {
		expect(parseCard("\n  Heat (1995)  \n\n  Ronin (1998)\n")).toEqual([
			{ title: "Heat", year: 1995, blurb: "" },
			{ title: "Ronin", year: 1998, blurb: "" },
		]);
	});

	it("drops duplicates, ignoring title case", () => {
		expect(parseCard("Heat (1995)\nheat (1995)\nHeat (1995)")).toHaveLength(1);
	});

	it("treats the same title in different years as distinct", () => {
		expect(parseCard("King Kong (1933)\nKing Kong (2005)")).toHaveLength(2);
	});
});

describe("serializeCard", () => {
	it("round-trips through parseCard", () => {
		const movies: Movie[] = [
			{ title: "Heat", year: 1995, blurb: "" },
			{ title: "I, Tonya", year: 0, blurb: "" },
		];
		expect(parseCard(serializeCard(movies))).toEqual(movies);
	});
});

describe("loadCustomMovies / saveCustomMovies", () => {
	it("round-trips a saved card", () => {
		const movies = parseCard("Heat (1995)\nRonin (1998)");
		saveCustomMovies(movies);
		expect(loadCustomMovies()).toEqual(movies);
	});

	it("returns [] when nothing is saved", () => {
		expect(loadCustomMovies()).toEqual([]);
	});

	it("returns [] on corrupt or non-array JSON", () => {
		store.set("whattowatch-custom-v1", "not json{");
		expect(loadCustomMovies()).toEqual([]);
		store.set("whattowatch-custom-v1", JSON.stringify({ nope: true }));
		expect(loadCustomMovies()).toEqual([]);
	});

	it("filters malformed entries and defaults missing blurbs", () => {
		store.set(
			"whattowatch-custom-v1",
			JSON.stringify([{ title: "Heat", year: 1995 }, { title: 42, year: 1995 }, null, "Heat"]),
		);
		expect(loadCustomMovies()).toEqual([{ title: "Heat", year: 1995, blurb: "" }]);
	});
});
