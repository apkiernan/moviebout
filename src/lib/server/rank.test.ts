import { describe, expect, it } from "vitest";
import { PRIOR_VOTES, weightedRating } from "./rank";

// weightedRating orders the "rated best" lineups (ADR 0001): it must favor
// widely seen films over niche darlings without letting quality stop
// mattering.

describe("weightedRating", () => {
	it("ranks a widely seen film above a niche darling with a higher raw rating", () => {
		const darling = { vote_average: 8.5, vote_count: 4000 };
		const canon = { vote_average: 8.2, vote_count: 60000 };
		expect(weightedRating(canon)).toBeGreaterThan(weightedRating(darling));
	});

	it("still lets quality beat sheer fame", () => {
		const acclaimed = { vote_average: 8.0, vote_count: 20000 };
		const blockbuster = { vote_average: 6.4, vote_count: 60000 };
		expect(weightedRating(acclaimed)).toBeGreaterThan(weightedRating(blockbuster));
	});

	it("approaches the raw rating as votes grow", () => {
		const rated = (vote_count: number) => weightedRating({ vote_average: 8.5, vote_count });
		expect(rated(1_000_000)).toBeGreaterThan(8.4);
		expect(rated(1_000_000)).toBeLessThan(8.5);
		expect(rated(100_000)).toBeLessThan(rated(1_000_000));
	});

	it("shrinks a barely-qualified film most of the way to the prior mean", () => {
		// 3000 votes is the genre lists' entry floor — clearing the gate must
		// not be enough to top the bracket.
		expect(weightedRating({ vote_average: 8.5, vote_count: 3000 })).toBeLessThan(7.4);
	});

	it("falls back to the prior mean when rating data is missing", () => {
		expect(weightedRating({})).toBe(7.0);
	});

	it("scales the prior to the medium — TV-sized vote counts need the TV prior", () => {
		// A canonical show: TV vote counts top out around ~15–25k on TMDB.
		const show = { vote_average: 8.7, vote_count: 12000 };
		// Under the movie prior it is shrunk most of the way to the mean...
		expect(weightedRating(show)).toBeLessThan(8.0);
		// ...under the TV prior it keeps its standing.
		expect(weightedRating(show, PRIOR_VOTES.tv)).toBeGreaterThan(8.4);
	});
});
