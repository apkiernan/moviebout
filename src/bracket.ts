import type { Movie } from "./data/movies";

export interface Bout {
	a: Movie | null;
	b: Movie | null;
	winner: "a" | "b" | null;
}

export type Rounds = Bout[][];

export const ROUND_NAMES = ["Round of 16", "Quarterfinals", "Semifinals", "The Final"];

export function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export function drawField(movies: Movie[]): Movie[] {
	return shuffle(movies).slice(0, 16);
}

export function seedRounds(field: Movie[]): Rounds {
	const first: Bout[] = [];
	for (let i = 0; i < 16; i += 2) {
		first.push({ a: field[i], b: field[i + 1], winner: null });
	}
	return [
		first,
		Array.from({ length: 4 }, () => ({ a: null, b: null, winner: null })),
		Array.from({ length: 2 }, () => ({ a: null, b: null, winner: null })),
		[{ a: null, b: null, winner: null }],
	];
}

export function boutWinner(bout: Bout): Movie | null {
	if (!bout.winner) return null;
	return bout.winner === "a" ? bout.a : bout.b;
}

/** The next undecided bout, in play order (all of round 0, then round 1, ...). */
export function currentBout(rounds: Rounds): { round: number; index: number } | null {
	for (let r = 0; r < rounds.length; r++) {
		for (let i = 0; i < rounds[r].length; i++) {
			if (!rounds[r][i].winner) return { round: r, index: i };
		}
	}
	return null;
}

/** Records a winner and advances them into the next round. Returns a new Rounds. */
export function pickWinner(rounds: Rounds, round: number, index: number, side: "a" | "b"): Rounds {
	const next: Rounds = rounds.map((bouts) => bouts.map((bout) => ({ ...bout })));
	const bout = next[round][index];
	bout.winner = side;
	const advancing = boutWinner(bout);
	if (round + 1 < next.length) {
		const target = next[round + 1][Math.floor(index / 2)];
		if (index % 2 === 0) target.a = advancing;
		else target.b = advancing;
	}
	return next;
}

export function champion(rounds: Rounds): Movie | null {
	return boutWinner(rounds[rounds.length - 1][0]);
}

/** Bout number within the whole tournament, 1-based (of 15). */
export function boutNumber(rounds: Rounds, round: number, index: number): number {
	let n = 0;
	for (let r = 0; r < round; r++) n += rounds[r].length;
	return n + index + 1;
}

export const TOTAL_BOUTS = 15;
