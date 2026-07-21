import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import {
	boutNumber,
	champion,
	currentBout,
	decidedBouts,
	drawField,
	isRounds,
	pickWinner,
	playableBouts,
	roundProgress,
	seedRounds,
	type Rounds,
} from "./bracket";
import { CUSTOM_LIST_ID, customList, loadCustomMovies, MIN_CARD_SIZE, saveCustomMovies } from "./customCard";
import type { Movie, MovieList } from "./movies";

const SAVE_KEY = "whattowatch-bracket-v1";

export interface SavedGame {
	listId: string;
	rounds: Rounds;
}

export function loadSave(): SavedGame | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SavedGame;
		if (!parsed.listId || !isRounds(parsed.rounds)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * The game in progress, shared by every route. Only user interaction mutates
 * it, so the prerenderer (where module state would be shared across pages)
 * only ever sees the empty initial state; each route guards against arriving
 * without the state it needs and restores from the save or bails home.
 */
class Game {
	listId = $state("");
	field = $state<Movie[]>([]);
	rounds = $state<Rounds | null>(null);
	history = $state<Rounds[]>([]);
	showBracket = $state(false);
	customMovies = $state<Movie[]>(browser ? loadCustomMovies() : []);

	cur = $derived(this.rounds ? currentBout(this.rounds) : null);
	champ = $derived(this.rounds ? champion(this.rounds) : null);
	progress = $derived(
		this.rounds && this.cur ? roundProgress(this.rounds, this.cur.round, this.cur.index) : null,
	);
	decidedCount = $derived(this.rounds ? decidedBouts(this.rounds) : 0);
	totalCount = $derived(this.rounds ? playableBouts(this.rounds) : 0);
	/** Keys the current matchup so a new bout remounts with fresh animation state. */
	boutKey = $derived(
		this.rounds && this.cur ? boutNumber(this.rounds, this.cur.round, this.cur.index) : 0,
	);

	/** The build-time lists plus the hand-picked card, once it's big enough to draw from. */
	allLists(lists: MovieList[]): MovieList[] {
		return this.customMovies.length >= MIN_CARD_SIZE
			? [...lists, customList(this.customMovies)]
			: lists;
	}

	startDraw(listId: string, movies: Movie[]) {
		this.listId = listId;
		this.field = drawField(movies);
		this.showBracket = false;
		goto("/field");
	}

	drawNewField(lists: MovieList[], listId: string) {
		const all = this.allLists(lists);
		const source = all.find((l) => l.id === listId) ?? all[0];
		this.startDraw(source.id, source.movies);
	}

	saveCard(movies: Movie[]) {
		saveCustomMovies(movies);
		this.customMovies = movies;
		this.startDraw(CUSTOM_LIST_ID, movies);
	}

	startTournament() {
		this.rounds = seedRounds(this.field);
		this.history = [];
		this.persist();
		goto("/play");
	}

	decide(side: "a" | "b") {
		if (!this.rounds || !this.cur) return;
		this.history = [...this.history, this.rounds];
		this.rounds = pickWinner(this.rounds, this.cur.round, this.cur.index, side);
		this.persist();
		if (champion(this.rounds)) goto("/champion");
	}

	undo() {
		if (this.history.length === 0) return;
		this.rounds = this.history[this.history.length - 1];
		this.history = this.history.slice(0, -1);
		this.persist();
		goto("/play");
	}

	/** Rehydrates a bracket from localStorage, e.g. after a reload on /play. */
	restoreFromSave(): boolean {
		const save = loadSave();
		if (!save) return false;
		this.listId = save.listId;
		this.rounds = save.rounds;
		this.history = [];
		return true;
	}

	resume() {
		if (!this.restoreFromSave()) return;
		goto(this.champ ? "/champion" : "/play");
	}

	scrapSave() {
		localStorage.removeItem(SAVE_KEY);
	}

	private persist() {
		if (!browser || !this.rounds) return;
		localStorage.setItem(
			SAVE_KEY,
			JSON.stringify({ listId: this.listId, rounds: $state.snapshot(this.rounds) }),
		);
	}
}

export const game = new Game();
