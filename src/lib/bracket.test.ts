import { describe, expect, it } from "vitest";
import type { Movie } from "./movies";
import {
	boutNumber,
	boutWinner,
	champion,
	currentBout,
	decidedBouts,
	drawField,
	isBye,
	isRounds,
	pickWinner,
	playableBouts,
	roundName,
	roundProgress,
	seedRounds,
	shuffle,
} from "./bracket";

function mv(i: number): Movie {
	return { title: `Movie ${i}`, year: 1990 + i, blurb: "" };
}

function field(n: number): Movie[] {
	return Array.from({ length: n }, (_, i) => mv(i));
}

/** Plays every remaining bout, always picking side "a". */
function playThrough(rounds: ReturnType<typeof seedRounds>) {
	let cur = currentBout(rounds);
	let picks = 0;
	while (cur) {
		rounds = pickWinner(rounds, cur.round, cur.index, "a");
		picks++;
		cur = currentBout(rounds);
	}
	return { rounds, picks };
}

describe("shuffle", () => {
	it("preserves membership and length without mutating the input", () => {
		const input = field(16);
		const copy = [...input];
		const out = shuffle(input);
		expect(input).toEqual(copy);
		expect(out).toHaveLength(16);
		expect(new Set(out)).toEqual(new Set(input));
	});
});

describe("drawField", () => {
	it("draws 16 unique movies from a larger pool", () => {
		const pool = field(40);
		const drawn = drawField(pool);
		expect(drawn).toHaveLength(16);
		expect(new Set(drawn).size).toBe(16);
		for (const movie of drawn) expect(pool).toContain(movie);
	});

	it("returns the whole pool when it has 16 or fewer", () => {
		expect(drawField(field(16))).toHaveLength(16);
	});

	it("honors an explicit field size", () => {
		expect(drawField(field(40), 24)).toHaveLength(24);
	});
});

describe("seedRounds", () => {
	it("seeds 16 movies into rounds of 8/4/2/1 bouts", () => {
		const rounds = seedRounds(field(16));
		expect(rounds.map((r) => r.length)).toEqual([8, 4, 2, 1]);
	});

	it("pairs the field in order in the first round", () => {
		const f = field(16);
		const rounds = seedRounds(f);
		rounds[0].forEach((bout, i) => {
			expect(bout.a).toBe(f[2 * i]);
			expect(bout.b).toBe(f[2 * i + 1]);
			expect(bout.winner).toBeNull();
		});
	});

	it("leaves later rounds empty and undecided", () => {
		const rounds = seedRounds(field(16));
		for (const bout of [...rounds[1], ...rounds[2], ...rounds[3]]) {
			expect(bout).toEqual({ a: null, b: null, winner: null });
		}
	});
});

describe("pickWinner", () => {
	it("records the winner and advances them into the right slot", () => {
		const f = field(16);
		let rounds = seedRounds(f);
		rounds = pickWinner(rounds, 0, 0, "a");
		expect(rounds[0][0].winner).toBe("a");
		expect(rounds[1][0].a).toBe(f[0]);
		rounds = pickWinner(rounds, 0, 1, "b");
		expect(rounds[1][0].b).toBe(f[3]);
		rounds = pickWinner(rounds, 0, 2, "a");
		expect(rounds[1][1].a).toBe(f[4]);
	});

	it("does not mutate the previous rounds (undo relies on this)", () => {
		const rounds = seedRounds(field(16));
		const next = pickWinner(rounds, 0, 0, "a");
		expect(rounds[0][0].winner).toBeNull();
		expect(rounds[1][0].a).toBeNull();
		expect(next).not.toBe(rounds);
	});
});

describe("currentBout and champion", () => {
	it("walks bouts in play order: all of round 0, then round 1, ...", () => {
		let rounds = seedRounds(field(16));
		expect(currentBout(rounds)).toEqual({ round: 0, index: 0 });
		rounds = pickWinner(rounds, 0, 0, "a");
		expect(currentBout(rounds)).toEqual({ round: 0, index: 1 });
		for (let i = 1; i < 8; i++) rounds = pickWinner(rounds, 0, i, "a");
		expect(currentBout(rounds)).toEqual({ round: 1, index: 0 });
	});

	it("always offers a bout with both participants set", () => {
		let rounds = seedRounds(field(16));
		let cur = currentBout(rounds);
		while (cur) {
			const bout = rounds[cur.round][cur.index];
			expect(bout.a).not.toBeNull();
			expect(bout.b).not.toBeNull();
			rounds = pickWinner(rounds, cur.round, cur.index, "b");
			cur = currentBout(rounds);
		}
	});

	it("has no champion until the final is decided", () => {
		const f = field(16);
		let rounds = seedRounds(f);
		expect(champion(rounds)).toBeNull();
		const { rounds: done, picks } = playThrough(rounds);
		expect(picks).toBe(15);
		expect(champion(done)).toBe(f[0]);
		expect(currentBout(done)).toBeNull();
	});
});

describe("boutWinner", () => {
	it("returns the winning side's movie, or null when undecided", () => {
		const bout = { a: mv(1), b: mv(2), winner: null };
		expect(boutWinner(bout)).toBeNull();
		expect(boutWinner({ ...bout, winner: "a" })).toBe(bout.a);
		expect(boutWinner({ ...bout, winner: "b" })).toBe(bout.b);
	});
});

describe("boutNumber and totals", () => {
	it("numbers bouts 1-based across the whole tournament", () => {
		const rounds = seedRounds(field(16));
		expect(boutNumber(rounds, 0, 0)).toBe(1);
		expect(boutNumber(rounds, 0, 7)).toBe(8);
		expect(boutNumber(rounds, 1, 0)).toBe(9);
		expect(boutNumber(rounds, 3, 0)).toBe(15);
		expect(playableBouts(rounds)).toBe(15);
	});
});

describe("roundName", () => {
	it("names the classic 16-movie bracket", () => {
		const rounds = seedRounds(field(16));
		expect(rounds.map((_, r) => roundName(rounds, r))).toEqual([
			"Round of 16",
			"Quarterfinals",
			"Semifinals",
			"The Final",
		]);
	});

	it("scales up to bigger fields", () => {
		const rounds = seedRounds(field(32));
		expect(roundName(rounds, 0)).toBe("Round of 32");
		expect(roundName(rounds, 1)).toBe("Round of 16");
	});

	it("calls a round with byes the play-ins", () => {
		const rounds = seedRounds(field(24));
		expect(rounds.map((_, r) => roundName(rounds, r))).toEqual([
			"Play-ins",
			"Round of 16",
			"Quarterfinals",
			"Semifinals",
			"The Final",
		]);
	});

	it("handles the tiniest brackets", () => {
		const two = seedRounds(field(2));
		expect(two.map((_, r) => roundName(two, r))).toEqual(["The Final"]);
		const three = seedRounds(field(3));
		expect(three.map((_, r) => roundName(three, r))).toEqual(["Play-ins", "The Final"]);
	});
});

describe("elastic fields", () => {
	it("rejects fields smaller than 2", () => {
		expect(() => seedRounds([])).toThrow();
		expect(() => seedRounds(field(1))).toThrow();
	});

	for (let n = 2; n <= 40; n++) {
		it(`seeds and plays a field of ${n} in exactly ${n - 1} bouts`, () => {
			const f = field(n);
			let rounds = seedRounds(f);
			const bracketSize = rounds[0].length * 2;

			// every movie is placed exactly once in the first round
			const placed = rounds[0].flatMap((b) => [b.a, b.b]).filter((m) => m !== null);
			expect(placed).toHaveLength(n);
			expect(new Set(placed).size).toBe(n);

			// the shortfall against the bracket size becomes pre-decided byes
			const byes = rounds[0].filter(isBye);
			expect(byes).toHaveLength(bracketSize - n);
			for (const bye of byes) {
				expect(bye.winner).toBe("a");
				expect(bye.b).toBeNull();
			}
			expect(playableBouts(rounds)).toBe(n - 1);
			expect(isRounds(rounds)).toBe(true);

			// play it out: every offered bout has both movies, no byes are offered
			let cur = currentBout(rounds);
			let picks = 0;
			while (cur) {
				const bout = rounds[cur.round][cur.index];
				expect(bout.a).not.toBeNull();
				expect(bout.b).not.toBeNull();
				expect(isBye(bout)).toBe(false);
				rounds = pickWinner(rounds, cur.round, cur.index, "b");
				picks++;
				cur = currentBout(rounds);
			}
			expect(picks).toBe(n - 1);
			expect(decidedBouts(rounds)).toBe(n - 1);
			expect(champion(rounds)).not.toBeNull();
		});
	}
});

describe("roundProgress", () => {
	it("matches the raw index when there are no byes", () => {
		const rounds = seedRounds(field(16));
		expect(roundProgress(rounds, 0, 0)).toEqual({ bout: 1, of: 8 });
		expect(roundProgress(rounds, 0, 7)).toEqual({ bout: 8, of: 8 });
		expect(roundProgress(rounds, 3, 0)).toEqual({ bout: 1, of: 1 });
	});

	it("skips byes when counting a play-in round", () => {
		const rounds = seedRounds(field(24)); // 16 first-round bouts, 8 of them byes
		const cur = currentBout(rounds);
		expect(cur).not.toBeNull();
		if (!cur) return;
		expect(roundProgress(rounds, cur.round, cur.index)).toEqual({ bout: 1, of: 8 });
	});
});

describe("isRounds", () => {
	it("accepts freshly seeded and partially played brackets", () => {
		for (const n of [2, 3, 16, 24, 33]) {
			let rounds = seedRounds(field(n));
			expect(isRounds(rounds)).toBe(true);
			const cur = currentBout(rounds);
			if (cur) rounds = pickWinner(rounds, cur.round, cur.index, "a");
			expect(isRounds(rounds)).toBe(true);
		}
	});

	it("accepts a save round-tripped through JSON", () => {
		const rounds = seedRounds(field(16));
		expect(isRounds(JSON.parse(JSON.stringify(rounds)))).toBe(true);
	});

	it("rejects malformed structures", () => {
		expect(isRounds(null)).toBe(false);
		expect(isRounds("bracket")).toBe(false);
		expect(isRounds([])).toBe(false);
		expect(isRounds([[]])).toBe(false);
		// doesn't halve down to a single final
		const noFinal = seedRounds(field(16)).slice(0, 3);
		expect(isRounds(noFinal)).toBe(false);
		// bouts missing their winner field
		expect(isRounds([[{ a: null, b: null }]])).toBe(false);
		// invalid winner value
		expect(isRounds([[{ a: null, b: null, winner: "c" }]])).toBe(false);
	});
});
