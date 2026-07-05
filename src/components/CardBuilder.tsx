import { useMemo, useState } from "react";
import type { Movie } from "../data/movies";
import { MIN_CARD_SIZE, parseCard, serializeCard } from "../customCard";

interface Props {
	movies: Movie[];
	onSave: (movies: Movie[]) => void;
	onBack: () => void;
}

/** Screen for entering a hand-picked lineup, one movie per line. */
export function CardBuilder({ movies, onSave, onBack }: Props) {
	const [text, setText] = useState(() => serializeCard(movies));
	const parsed = useMemo(() => parseCard(text), [text]);
	const missing = MIN_CARD_SIZE - parsed.length;

	return (
		<main className="builder">
			<p className="eyebrow">Bring your own movies</p>
			<h1 className="display builder__title">Build Your Card</h1>
			<section className="panel builder__panel">
				<label className="picker-label" htmlFor="card-text">
					One movie per line — “Heat (1995)” or just “Heat”
				</label>
				<textarea
					id="card-text"
					className="builder__text"
					rows={16}
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={"Heat (1995)\nMoonstruck (1987)\nThe Fugitive (1993)\n…"}
					spellCheck={false}
				/>
				<p className="builder__count" role="status">
					{parsed.length} {parsed.length === 1 ? "movie" : "movies"} on the card
					{missing > 0 ? ` — ${missing} more to fill a bracket` : " — ready to draw"}
				</p>
				<div className="row">
					<button type="button" className="btn-ghost" onClick={onBack}>
						Back to the lobby
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={() => onSave(parsed)}
						disabled={parsed.length < MIN_CARD_SIZE}
					>
						Save &amp; draw the bracket
					</button>
				</div>
			</section>
		</main>
	);
}
