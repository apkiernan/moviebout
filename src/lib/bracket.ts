import type { Movie } from "./movies";

export interface Bout {
	a: Movie | null;
	b: Movie | null;
	winner: "a" | "b" | null;
}

export type Rounds = Bout[][];

/** How many movies the standard lineups draw. */
export const DEFAULT_FIELD_SIZE = 16;

export function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export function drawField(movies: Movie[], size = DEFAULT_FIELD_SIZE): Movie[] {
	return shuffle(movies).slice(0, size);
}

/** Advances a decided bout's winner into its slot in the next round. Mutates. */
function advance(rounds: Rounds, round: number, index: number) {
	if (round + 1 >= rounds.length) return;
	const target = rounds[round + 1][Math.floor(index / 2)];
	if (index % 2 === 0) target.a = boutWinner(rounds[round][index]);
	else target.b = boutWinner(rounds[round][index]);
}

/**
 * Seeds a field of any size (≥ 2) into a single-elimination bracket.
 *
 * The bracket is the next power of two up from the field. When the field
 * doesn't fill it, the shortfall becomes byes: first-round bouts holding a
 * single movie, decided at seed time and spread evenly across the round so
 * bye winners don't meet each other early. Whatever the field size, the
 * players decide exactly `field.length - 1` bouts.
 */
export function seedRounds(field: Movie[]): Rounds {
	const n = field.length;
	if (n < 2) throw new Error(`A bracket needs at least 2 movies, got ${n}`);
	let size = 2;
	while (size < n) size *= 2;

	const rounds: Rounds = [];
	for (let bouts = size / 2; bouts >= 1; bouts /= 2) {
		rounds.push(Array.from({ length: bouts }, () => ({ a: null, b: null, winner: null })));
	}

	const byes = size - n;
	const first = rounds[0];
	// byes < first.length (the field more than half-fills the bracket), so
	// these indices are distinct and evenly spaced.
	const byeIndexes = new Set<number>();
	for (let k = 0; k < byes; k++) byeIndexes.add(Math.floor((k * first.length) / byes));

	let next = 0;
	for (let i = 0; i < first.length; i++) {
		first[i].a = field[next++];
		if (byeIndexes.has(i)) {
			first[i].winner = "a";
			advance(rounds, 0, i);
		} else {
			first[i].b = field[next++];
		}
	}
	return rounds;
}

export function boutWinner(bout: Bout): Movie | null {
	if (!bout.winner) return null;
	return bout.winner === "a" ? bout.a : bout.b;
}

/** A bye: a first-round bout with a single movie, decided at seed time. */
export function isBye(bout: Bout): boolean {
	return bout.winner !== null && (bout.a === null || bout.b === null);
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
	next[round][index].winner = side;
	advance(next, round, index);
	return next;
}

export function champion(rounds: Rounds): Movie | null {
	return boutWinner(rounds[rounds.length - 1][0]);
}

export function roundName(rounds: Rounds, round: number): string {
	if (rounds[round].some(isBye)) return "Play-ins";
	const bouts = rounds[round].length;
	if (bouts === 1) return "The Final";
	if (bouts === 2) return "Semifinals";
	if (bouts === 4) return "Quarterfinals";
	return `Round of ${bouts * 2}`;
}

/** Bouts the players actually decide (byes excluded) — always field size − 1. */
export function playableBouts(rounds: Rounds): number {
	return rounds.flat().filter((bout) => !isBye(bout)).length;
}

/** Decided bouts, not counting byes — pairs with playableBouts for progress. */
export function decidedBouts(rounds: Rounds): number {
	return rounds.flat().filter((bout) => bout.winner !== null && !isBye(bout)).length;
}

/** A bout's position among the playable bouts of its round, 1-based. */
export function roundProgress(
	rounds: Rounds,
	round: number,
	index: number,
): { bout: number; of: number } {
	const bouts = rounds[round];
	let bout = 0;
	for (let i = 0; i <= index; i++) if (!isBye(bouts[i])) bout++;
	return { bout, of: bouts.filter((b) => !isBye(b)).length };
}

/** Bout number within the whole tournament, 1-based. */
export function boutNumber(rounds: Rounds, round: number, index: number): number {
	let n = 0;
	for (let r = 0; r < round; r++) n += rounds[r].length;
	return n + index + 1;
}

function isMovie(value: unknown): value is Movie {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as Movie).title === "string" &&
		typeof (value as Movie).year === "number"
	);
}

function isBout(value: unknown): value is Bout {
	if (typeof value !== "object" || value === null) return false;
	const bout = value as Bout;
	const side = (s: unknown) => s === null || isMovie(s);
	return (
		side(bout.a) &&
		side(bout.b) &&
		(bout.winner === null || bout.winner === "a" || bout.winner === "b")
	);
}

/** Structural check for persisted bracket state: halving rounds down to a single final. */
export function isRounds(value: unknown): value is Rounds {
	if (!Array.isArray(value) || value.length === 0) return false;
	for (let r = 0; r < value.length; r++) {
		const round: unknown = value[r];
		if (!Array.isArray(round) || round.length === 0 || !round.every(isBout)) return false;
		if (r > 0 && (value[r - 1] as unknown[]).length !== round.length * 2) return false;
	}
	return (value[value.length - 1] as unknown[]).length === 1;
}
