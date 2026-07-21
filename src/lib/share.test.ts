import { describe, expect, it } from "vitest";
import { champion, currentBout, pickWinner, seedRounds, type Rounds } from "./bracket";
import type { Movie, MovieList } from "./movies";
import { decodeShare, encodeShare, resolveShare } from "./share";

function mv(i: number): Movie {
	return { id: 100000 + i, title: `Movie ${i}`, year: 1990 + i, blurb: `Blurb ${i}` };
}

function customMv(i: number): Movie {
	return { title: `Hand-Picked ${i}`, year: 2000 + i, blurb: "" };
}

function field(n: number, make = mv): Movie[] {
	return Array.from({ length: n }, (_, i) => make(i));
}

/** Plays every bout with an alternating a/b pattern so picks aren't uniform. */
function playThrough(rounds: Rounds): Rounds {
	let cur = currentBout(rounds);
	let k = 0;
	while (cur) {
		rounds = pickWinner(rounds, cur.round, cur.index, k++ % 3 === 0 ? "b" : "a");
		cur = currentBout(rounds);
	}
	return rounds;
}

function lists(movies: Movie[]): MovieList[] {
	return [{ id: "test-list", name: "Test List", tagline: "For testing", movies }];
}

describe("encodeShare", () => {
	it("produces a URL-safe token", () => {
		const rounds = playThrough(seedRounds(field(16)));
		const token = encodeShare("test-list", rounds);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it("throws on an unfinished bracket", () => {
		const rounds = seedRounds(field(16));
		expect(() => encodeShare("test-list", rounds)).toThrow(/finished/);
	});
});

describe("round-trip", () => {
	it("reconstructs the same field, picks, and champion", () => {
		const source = field(16);
		const rounds = playThrough(seedRounds(source));
		const token = encodeShare("test-list", rounds);

		const shared = resolveShare(decodeShare(token)!, lists(source));
		expect(shared).not.toBeNull();
		expect(shared!.listId).toBe("test-list");
		expect(shared!.listName).toBe("Test List");
		expect(shared!.field.map((m) => m.title)).toEqual(source.map((m) => m.title));
		expect(shared!.champion.title).toBe(champion(rounds)!.title);
		expect(shared!.rounds).toEqual(rounds);
	});

	it("resolves baked movies to their full entries — poster, blurb, cast", () => {
		const source = field(16).map((m) => ({
			...m,
			poster: `https://image.tmdb.org/poster-${m.id}.jpg`,
			cast: ["Someone"],
		}));
		const rounds = playThrough(seedRounds(source));
		const shared = resolveShare(decodeShare(encodeShare("test-list", rounds))!, lists(source));
		expect(shared!.champion.poster).toBeDefined();
		expect(shared!.field.every((m) => m.poster && m.cast)).toBe(true);
	});

	it("handles byes — a field that doesn't fill the bracket", () => {
		const source = field(12);
		const rounds = playThrough(seedRounds(source));
		const shared = resolveShare(decodeShare(encodeShare("test-list", rounds))!, lists(source));
		expect(shared!.field).toHaveLength(12);
		expect(shared!.rounds).toEqual(rounds);
	});

	it("round-trips a custom card — no ids, unicode titles intact", () => {
		const source = field(16, customMv);
		source[3] = { title: "Amélie — 「アメリ」 🎬", year: 2001, blurb: "" };
		const rounds = playThrough(seedRounds(source));
		const shared = resolveShare(decodeShare(encodeShare("custom", rounds))!, lists(field(16)));
		expect(shared!.listId).toBe("custom");
		expect(shared!.listName).toBeNull();
		expect(shared!.field[3].title).toBe("Amélie — 「アメリ」 🎬");
		expect(shared!.champion.title).toBe(champion(rounds)!.title);
	});
});

describe("data-refresh drift", () => {
	it("keeps the champion renderable after its movie rotates out of the lists", () => {
		const source = field(16);
		const rounds = playThrough(seedRounds(source));
		const champ = champion(rounds)!;
		const rotated = lists(source.filter((m) => m.id !== champ.id));

		const shared = resolveShare(decodeShare(encodeShare("test-list", rounds))!, rotated);
		expect(shared!.champion.title).toBe(champ.title);
		expect(shared!.champion.year).toBe(champ.year);
	});

	it("placeholders a non-champion movie that rotated out", () => {
		const source = field(16);
		const rounds = playThrough(seedRounds(source));
		const champ = champion(rounds)!;
		const gone = source.find((m) => m.id !== champ.id)!;
		const rotated = lists(source.filter((m) => m !== gone));

		const shared = resolveShare(decodeShare(encodeShare("test-list", rounds))!, rotated);
		const placeholder = shared!.field[source.indexOf(gone)];
		expect(placeholder.title).toBe("—");
		expect(placeholder.id).toBe(gone.id);
	});
});

describe("decodeShare on hostile input", () => {
	it("rejects garbage", () => {
		expect(decodeShare("")).toBeNull();
		expect(decodeShare("!!!not base64!!!")).toBeNull();
		expect(decodeShare("AAAA")).toBeNull();
		expect(decodeShare("deadbeef".repeat(20))).toBeNull();
	});

	it("rejects a truncated token", () => {
		const rounds = playThrough(seedRounds(field(16)));
		const token = encodeShare("test-list", rounds);
		expect(decodeShare(token.slice(0, token.length - 4))).toBeNull();
	});

	it("rejects an unknown version", () => {
		const rounds = playThrough(seedRounds(field(16)));
		const token = encodeShare("test-list", rounds);
		// Flip the version byte (first byte → first two base64 chars).
		expect(decodeShare(`z${token.slice(1)}`)).toBeNull();
	});
});
