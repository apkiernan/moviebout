// Encodes a finished bracket as a compact token for share URLs (ADR 0003):
// the field in seed order plus one bit per decided bout. The bracket shape —
// byes included — is fully determined by the field size (seedRounds is
// deterministic), so decoding is a replay: seed the field, apply the picks.
//
// Baked movies travel as TMDB ids, which stay valid across weekly data
// refreshes; the champion additionally carries its title/year inline so the
// share headline renders even after its movie rotates out of the baked
// lists. Custom-card movies have no id and travel entirely inline.

import { champion, currentBout, isBye, pickWinner, seedRounds, type Rounds } from "./bracket";
import type { Movie, MovieList } from "./movies";

const VERSION = 1;

// Decode bounds: tokens come from the wild, so cap every length before
// trusting it. Real tokens are nowhere near these.
const MAX_FIELD = 128;
const MAX_LIST_ID = 64;
const MAX_TITLE = 512;

/** A field movie as it travels in the token. */
export interface ShareRef {
	id?: number;
	title?: string;
	year?: number;
}

export interface DecodedShare {
	listId: string;
	refs: ShareRef[];
	picks: ("a" | "b")[];
}

/** A share resolved against the baked lists, ready to render. */
export interface SharedBracket {
	listId: string;
	/** The lineup's display name, or null if it's gone (or a custom card). */
	listName: string | null;
	field: Movie[];
	rounds: Rounds;
	champion: Movie;
}

function pushVarint(bytes: number[], value: number) {
	let v = value;
	while (v > 0x7f) {
		bytes.push((v & 0x7f) | 0x80);
		v = Math.floor(v / 128);
	}
	bytes.push(v);
}

function pushString(bytes: number[], text: string) {
	const utf8 = new TextEncoder().encode(text);
	pushVarint(bytes, utf8.length);
	for (const b of utf8) bytes.push(b);
}

class Reader {
	private pos = 0;
	constructor(private bytes: Uint8Array) {}

	u8(): number {
		if (this.pos >= this.bytes.length) throw new Error("truncated");
		return this.bytes[this.pos++];
	}

	varint(): number {
		let value = 0;
		for (let shift = 0; shift <= 35; shift += 7) {
			const b = this.u8();
			value += (b & 0x7f) * 2 ** shift;
			if ((b & 0x80) === 0) return value;
		}
		throw new Error("varint too long");
	}

	string(maxLength: number): string {
		const length = this.varint();
		if (length > maxLength || this.pos + length > this.bytes.length) throw new Error("bad string");
		const text = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + length));
		this.pos += length;
		return text;
	}

	done(): boolean {
		return this.pos === this.bytes.length;
	}
}

function toBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): Uint8Array | null {
	if (token.length === 0 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
	const b64 = token.replaceAll("-", "+").replaceAll("_", "/");
	try {
		const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
		return Uint8Array.from(bin, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

/** The share key of a movie: TMDB id when it has one, title|year otherwise. */
function movieKey(movie: Movie): string {
	return movie.id ? `#${movie.id}` : `${movie.title}|${movie.year}`;
}

/** Encodes a finished bracket as a URL-safe token. Throws on an unfinished one. */
export function encodeShare(listId: string, rounds: Rounds): string {
	const champ = champion(rounds);
	if (!champ) throw new Error("Only a finished bracket can be shared");

	// seedRounds lays the field into round 0 in order (a, then b unless a bye),
	// so reading it back recovers the original seed order.
	const field: Movie[] = [];
	for (const bout of rounds[0]) {
		if (bout.a) field.push(bout.a);
		if (bout.b) field.push(bout.b);
	}
	const champIndex = field.findIndex((m) => movieKey(m) === movieKey(champ));

	// One bit per playable bout, in play order — the order currentBout yields
	// them during the replay on decode.
	const picks: number[] = [];
	for (const bouts of rounds) {
		for (const bout of bouts) {
			if (isBye(bout)) continue;
			if (!bout.winner) throw new Error("Only a finished bracket can be shared");
			picks.push(bout.winner === "b" ? 1 : 0);
		}
	}

	const bytes: number[] = [VERSION];
	pushString(bytes, listId);
	pushVarint(bytes, field.length);
	field.forEach((movie, i) => {
		const hasId = (movie.id ?? 0) > 0;
		const inline = i === champIndex || !hasId;
		bytes.push((hasId ? 1 : 0) | (inline ? 2 : 0));
		if (hasId) pushVarint(bytes, movie.id!);
		if (inline) {
			pushVarint(bytes, movie.year);
			pushString(bytes, movie.title);
		}
	});
	const pickBytes = new Uint8Array(Math.ceil(picks.length / 8));
	picks.forEach((pick, k) => {
		if (pick) pickBytes[k >> 3] |= 1 << (k & 7);
	});
	for (const b of pickBytes) bytes.push(b);

	return toBase64Url(Uint8Array.from(bytes));
}

/** Decodes a token back into refs and picks. Null on anything malformed. */
export function decodeShare(token: string): DecodedShare | null {
	const bytes = fromBase64Url(token);
	if (!bytes) return null;
	try {
		const r = new Reader(bytes);
		if (r.u8() !== VERSION) return null;
		const listId = r.string(MAX_LIST_ID);
		const n = r.varint();
		if (n < 2 || n > MAX_FIELD) return null;

		const refs: ShareRef[] = [];
		for (let i = 0; i < n; i++) {
			const flags = r.u8();
			if (flags === 0 || flags > 3) return null;
			const ref: ShareRef = {};
			if (flags & 1) ref.id = r.varint();
			if (flags & 2) {
				ref.year = r.varint();
				ref.title = r.string(MAX_TITLE);
			}
			refs.push(ref);
		}

		const picks: ("a" | "b")[] = [];
		const pickBytes = Array.from({ length: Math.ceil((n - 1) / 8) }, () => r.u8());
		for (let k = 0; k < n - 1; k++) {
			picks.push((pickBytes[k >> 3] >> (k & 7)) & 1 ? "b" : "a");
		}

		if (!r.done()) return null;
		return { listId, refs, picks };
	} catch {
		return null;
	}
}

/**
 * Resolves refs against the baked lists and replays the bracket. Movies that
 * have rotated out of the lists fall back to their inline title/year (the
 * champion always has one) or an em-dash placeholder. Null if the replay
 * doesn't produce a finished bracket.
 */
export function resolveShare(decoded: DecodedShare, lists: MovieList[]): SharedBracket | null {
	if (decoded.refs.length < 2) return null;

	const byId = new Map<number, Movie>();
	for (const list of lists) {
		for (const movie of list.movies) {
			if (movie.id) byId.set(movie.id, movie);
		}
	}

	const field = decoded.refs.map((ref): Movie => {
		const baked = ref.id ? byId.get(ref.id) : undefined;
		if (baked) return baked;
		return { id: ref.id, title: ref.title ?? "—", year: ref.year ?? 0, blurb: "" };
	});

	let rounds = seedRounds(field);
	for (const pick of decoded.picks) {
		const cur = currentBout(rounds);
		if (!cur) return null;
		rounds = pickWinner(rounds, cur.round, cur.index, pick);
	}
	const champ = champion(rounds);
	if (!champ || currentBout(rounds)) return null;

	return {
		listId: decoded.listId,
		listName: lists.find((l) => l.id === decoded.listId)?.name ?? null,
		field,
		rounds,
		champion: champ,
	};
}
