import type { Movie } from "../data/movies";

export type TicketState = "idle" | "winner" | "loser";

function serial(movie: Movie): string {
	let h = 0;
	const s = movie.title + movie.year;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return String(h % 1_000_000).padStart(6, "0");
}

interface Props {
	movie: Movie;
	state?: TicketState;
	highlight?: boolean;
	disabled?: boolean;
	onPick?: () => void;
}

export function TicketCard({
	movie,
	state = "idle",
	highlight = false,
	disabled = false,
	onPick,
}: Props) {
	const classes = ["ticket", `ticket--${state}`];
	if (movie.poster) classes.push("ticket--art");
	if (highlight) classes.push("ticket--coin");
	return (
		<button type="button" className={classes.join(" ")} onClick={onPick} disabled={disabled}>
			<span className="ticket__strip" aria-hidden="true">
				Admit One
			</span>
			{movie.poster && (
				<img className="ticket__poster" src={movie.poster} alt="" loading="lazy" decoding="async" />
			)}
			<span className="ticket__body">
				<span className="ticket__title">{movie.title}</span>
				{movie.year > 0 && <span className="ticket__year">{movie.year}</span>}
				{movie.blurb && <span className="ticket__blurb">{movie.blurb}</span>}
				{movie.cast && movie.cast.length > 0 && (
					<span className="ticket__cast">{movie.cast.join(" · ")}</span>
				)}
			</span>
			<span className="ticket__serial" aria-hidden="true">
				No. {serial(movie)} · General Admission
			</span>
			{state === "winner" && (
				<span className="ticket__stamp" aria-hidden="true">
					Winner
				</span>
			)}
		</button>
	);
}
