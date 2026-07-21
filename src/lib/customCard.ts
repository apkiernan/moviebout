import type { Movie, MovieList } from "./movies";

export const CUSTOM_LIST_ID = "custom";

/** A bracket needs a full field of 16. */
export const MIN_CARD_SIZE = 16;

const STORE_KEY = "whattowatch-custom-v1";

/** Parses one movie per line — "Heat (1995)", "Heat, 1995", or just "Heat". Duplicates are dropped. */
export function parseCard(text: string): Movie[] {
	const seen = new Set<string>();
	const movies: Movie[] = [];
	for (const line of text.split("\n")) {
		const raw = line.trim();
		if (!raw) continue;
		const match = raw.match(/^(.*?)\s*(?:\((\d{4})\)|,\s*(\d{4}))$/);
		const title = (match ? match[1] : raw).trim();
		if (!title) continue;
		const year = match ? Number(match[2] ?? match[3]) : 0;
		const key = `${title.toLowerCase()}|${year}`;
		if (seen.has(key)) continue;
		seen.add(key);
		movies.push({ title, year, blurb: "" });
	}
	return movies;
}

export function serializeCard(movies: Movie[]): string {
	return movies.map((m) => (m.year ? `${m.title} (${m.year})` : m.title)).join("\n");
}

export function loadCustomMovies(): Movie[] {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(m): m is Movie =>
					typeof m === "object" &&
					m !== null &&
					typeof (m as Movie).title === "string" &&
					typeof (m as Movie).year === "number",
			)
			.map((m) => ({ title: m.title, year: m.year, blurb: m.blurb ?? "" }));
	} catch {
		return [];
	}
}

export function saveCustomMovies(movies: Movie[]) {
	localStorage.setItem(STORE_KEY, JSON.stringify(movies));
}

export function customList(movies: Movie[]): MovieList {
	return {
		id: CUSTOM_LIST_ID,
		name: "Your Own Card",
		tagline: "Hand-picked — your lineup, your rules",
		movies,
	};
}
