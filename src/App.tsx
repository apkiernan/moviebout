import { useEffect, useMemo, useState } from "react";
import { MOVIE_LISTS } from "./data/movies";
import type { Movie } from "./data/movies";
import type { Rounds } from "./bracket";
import {
	ROUND_NAMES,
	TOTAL_BOUTS,
	boutNumber,
	champion,
	currentBout,
	drawField,
	pickWinner,
	seedRounds,
} from "./bracket";
import { Marquee } from "./components/Marquee";
import { Matchup } from "./components/Matchup";
import { BracketView } from "./components/BracketView";
import { CardBuilder } from "./components/CardBuilder";
import { ShareButton } from "./components/ShareButton";
import {
	CUSTOM_LIST_ID,
	MIN_CARD_SIZE,
	customList,
	loadCustomMovies,
	saveCustomMovies,
} from "./customCard";

type Screen = "home" | "field" | "play" | "champion" | "builder";

const SAVE_KEY = "whattowatch-bracket-v1";

interface SavedGame {
	listId: string;
	rounds: Rounds;
}

function loadSave(): SavedGame | null {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SavedGame;
		if (!parsed.listId || !Array.isArray(parsed.rounds) || parsed.rounds.length !== 4) return null;
		return parsed;
	} catch {
		return null;
	}
}

export default function App() {
	const [screen, setScreen] = useState<Screen>("home");
	const [listId, setListId] = useState(MOVIE_LISTS[0].id);
	const [field, setField] = useState<Movie[]>([]);
	const [rounds, setRounds] = useState<Rounds | null>(null);
	const [history, setHistory] = useState<Rounds[]>([]);
	const [showBracket, setShowBracket] = useState(false);
	const [save, setSave] = useState<SavedGame | null>(() => loadSave());
	const [customMovies, setCustomMovies] = useState<Movie[]>(() => loadCustomMovies());

	const allLists = useMemo(
		() =>
			customMovies.length >= MIN_CARD_SIZE
				? [...MOVIE_LISTS, customList(customMovies)]
				: MOVIE_LISTS,
		[customMovies],
	);

	const list = useMemo(
		() => allLists.find((l) => l.id === listId) ?? MOVIE_LISTS[0],
		[allLists, listId],
	);

	useEffect(() => {
		if (rounds && (screen === "play" || screen === "champion")) {
			localStorage.setItem(SAVE_KEY, JSON.stringify({ listId, rounds }));
		}
	}, [rounds, listId, screen]);

	function startDraw(fromListId: string, movies: Movie[]) {
		setListId(fromListId);
		setField(drawField(movies));
		setShowBracket(false);
		setScreen("field");
	}

	function drawNewField(fromListId: string) {
		const source = allLists.find((l) => l.id === fromListId) ?? MOVIE_LISTS[0];
		startDraw(source.id, source.movies);
	}

	function saveCard(movies: Movie[]) {
		saveCustomMovies(movies);
		setCustomMovies(movies);
		startDraw(CUSTOM_LIST_ID, movies);
	}

	function startTournament() {
		setRounds(seedRounds(field));
		setHistory([]);
		setScreen("play");
	}

	function resume() {
		if (!save) return;
		setListId(save.listId);
		setRounds(save.rounds);
		setHistory([]);
		setScreen(champion(save.rounds) ? "champion" : "play");
	}

	function scrapSave() {
		localStorage.removeItem(SAVE_KEY);
		setSave(null);
	}

	function decide(side: "a" | "b") {
		if (!rounds) return;
		const cur = currentBout(rounds);
		if (!cur) return;
		setHistory((h) => [...h, rounds]);
		const next = pickWinner(rounds, cur.round, cur.index, side);
		setRounds(next);
		if (champion(next)) setScreen("champion");
	}

	function undo() {
		setHistory((h) => {
			if (h.length === 0) return h;
			setRounds(h[h.length - 1]);
			setScreen("play");
			return h.slice(0, -1);
		});
	}

	function goHome() {
		setSave(loadSave());
		setShowBracket(false);
		setScreen("home");
	}

	const cur = rounds ? currentBout(rounds) : null;
	const decidedCount = rounds ? rounds.flat().filter((b) => b.winner).length : 0;
	const champ = rounds ? champion(rounds) : null;

	const saveInfo = useMemo(() => {
		if (!save) return null;
		const savedList = allLists.find((l) => l.id === save.listId);
		const savedCur = currentBout(save.rounds);
		if (!savedList || !savedCur) return null;
		return {
			listName: savedList.name,
			roundName: ROUND_NAMES[savedCur.round],
			bout: savedCur.index + 1,
			of: save.rounds[savedCur.round].length,
		};
	}, [allLists, save]);

	return (
		<div className="app">
			{screen !== "home" && (
				<header className="topbar">
					<button type="button" className="brand" onClick={goHome}>
						What to Watch
					</button>
					{screen === "play" && rounds && (
						<div className="topbar__actions">
							<button
								type="button"
								className="btn-ghost btn-small"
								onClick={() => setShowBracket(true)}
							>
								See the bracket
							</button>
							<button
								type="button"
								className="btn-ghost btn-small"
								onClick={undo}
								disabled={history.length === 0}
							>
								Undo last pick
							</button>
						</div>
					)}
				</header>
			)}

			{screen === "home" && (
				<main className="home">
					<Marquee big>
						<p className="eyebrow">Date night · Main event</p>
						<h1 className="display home__title">What to Watch</h1>
						<p className="home__sub">Sixteen movies enter. One leaves — on your TV.</p>
					</Marquee>

					{saveInfo && (
						<section className="panel resume">
							<p className="resume__text">
								A bracket is still in progress — <strong>{saveInfo.listName}</strong>,{" "}
								{saveInfo.roundName.toLowerCase()}, bout {saveInfo.bout} of {saveInfo.of}.
							</p>
							<div className="row">
								<button type="button" className="btn-primary btn-small" onClick={resume}>
									Resume the bracket
								</button>
								<button type="button" className="btn-ghost btn-small" onClick={scrapSave}>
									Scrap it
								</button>
							</div>
						</section>
					)}

					<section className="panel card-picker">
						<p className="eyebrow">Tonight’s card</p>
						<label className="picker-label" htmlFor="list-select">
							Pick a lineup
						</label>
						<select
							id="list-select"
							className="list-select"
							value={listId}
							onChange={(e) => setListId(e.target.value)}
						>
							{allLists.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
						<p className="list-tagline">
							{list.tagline} · {list.movies.length} movies on the card
						</p>
						<button type="button" className="btn-primary" onClick={() => drawNewField(listId)}>
							Draw the bracket
						</button>
						<button
							type="button"
							className="btn-ghost btn-small"
							onClick={() => setScreen("builder")}
						>
							{customMovies.length > 0
								? `Edit your own card (${customMovies.length} movies)`
								: "Or build your own card"}
						</button>
					</section>

					<footer className="home__foot">
						16 random movies · head-to-head votes · winner gets watched
					</footer>
				</main>
			)}

			{screen === "field" && (
				<main className="field">
					<p className="eyebrow">Tonight’s card · {list.name}</p>
					<h1 className="display field__title">The Field of 16</h1>
					<div className="field__grid">
						{field.map((movie) => (
							<div className="mini-ticket" key={movie.title + movie.year}>
								{movie.poster ? (
									<img
										className="mini-ticket__poster"
										src={movie.poster}
										alt=""
										loading="lazy"
										decoding="async"
									/>
								) : (
									<span className="mini-ticket__placeholder" aria-hidden="true">
										{movie.title.replace(/^(the|a|an) /i, "").charAt(0)}
									</span>
								)}
								<span className="mini-ticket__text">
									<span className="mini-ticket__title">{movie.title}</span>
									{movie.year > 0 && <span className="mini-ticket__year">{movie.year}</span>}
								</span>
							</div>
						))}
					</div>
					<div className="row field__actions">
						<button type="button" className="btn-ghost" onClick={() => drawNewField(listId)}>
							Shuffle again
						</button>
						<button type="button" className="btn-primary" onClick={startTournament}>
							Start the tournament
						</button>
					</div>
				</main>
			)}

			{screen === "play" && rounds && cur && (
				<main className="play">
					<p className="eyebrow play__round">
						{ROUND_NAMES[cur.round]} · Bout {cur.index + 1} of {rounds[cur.round].length}
					</p>
					<p className="play__hint">Tap the ticket you’d rather watch</p>
					<Matchup
						key={boutNumber(rounds, cur.round, cur.index)}
						bout={rounds[cur.round][cur.index]}
						onDecide={decide}
						inputLocked={showBracket}
					/>
					<div className="progress" aria-label={`${decidedCount} of ${TOTAL_BOUTS} bouts decided`}>
						{Array.from({ length: TOTAL_BOUTS }, (_, i) => (
							<span
								key={i}
								className={
									i < decidedCount
										? "tick tick--done"
										: i === decidedCount
											? "tick tick--now"
											: "tick"
								}
							/>
						))}
					</div>
				</main>
			)}

			{screen === "champion" && champ && (
				<main className="champion">
					<p className="eyebrow">And your winner is</p>
					<Marquee big>
						<p className="now-showing">Now Showing</p>
						<div className="champion__content">
							{champ.poster && <img className="champion__poster" src={champ.poster} alt="" />}
							<div className="champion__text">
								<h1 className="display champion__title">{champ.title}</h1>
								<p className="champion__meta">
									{[champ.year, champ.blurb].filter(Boolean).join(" · ")}
								</p>
								{champ.cast && champ.cast.length > 0 && (
									<p className="champion__cast">Starring {champ.cast.join(", ")}</p>
								)}
							</div>
						</div>
					</Marquee>
					<div className="row champion__actions">
						<ShareButton champion={champ} />
						<a
							className="btn-ghost"
							href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(champ.title)}`}
							target="_blank"
							rel="noreferrer"
						>
							Where to stream it
						</a>
					</div>
					<div className="row champion__actions">
						<button type="button" className="btn-ghost" onClick={() => setShowBracket(true)}>
							See the bracket
						</button>
						<button
							type="button"
							className="btn-ghost"
							onClick={undo}
							disabled={history.length === 0}
						>
							Undo the final
						</button>
						<button type="button" className="btn-ghost" onClick={() => drawNewField(listId)}>
							Run it back
						</button>
					</div>
					<button
						type="button"
						className="btn-ghost btn-small champion__new"
						onClick={() => {
							scrapSave();
							goHome();
						}}
					>
						Pick a new card
					</button>
				</main>
			)}

			{screen === "builder" && (
				<CardBuilder movies={customMovies} onSave={saveCard} onBack={goHome} />
			)}

			{showBracket && rounds && (
				<BracketView rounds={rounds} onClose={() => setShowBracket(false)} />
			)}
		</div>
	);
}
