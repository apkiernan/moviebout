import { useEffect } from "react";
import type { Bout, Rounds } from "../bracket";
import { ROUND_NAMES, champion } from "../bracket";
import type { Movie } from "../data/movies";

function Slot({ movie, won, lost }: { movie: Movie | null; won: boolean; lost: boolean }) {
	const classes = ["bv-slot"];
	if (won) classes.push("bv-slot--won");
	if (lost) classes.push("bv-slot--lost");
	return (
		<div className={classes.join(" ")}>
			{movie ? (
				<span className="bv-slot__name">{movie.title}</span>
			) : (
				<span className="bv-slot__tbd">TBD</span>
			)}
		</div>
	);
}

function BoutBox({ bout }: { bout: Bout }) {
	return (
		<div className="bv-bout">
			<Slot movie={bout.a} won={bout.winner === "a"} lost={bout.winner === "b"} />
			<Slot movie={bout.b} won={bout.winner === "b"} lost={bout.winner === "a"} />
		</div>
	);
}

interface Props {
	rounds: Rounds;
	onClose: () => void;
}

export function BracketView({ rounds, onClose }: Props) {
	const champ = champion(rounds);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	return (
		<div className="bv-overlay" role="dialog" aria-label="Tournament bracket">
			<div className="bv-top">
				<h2 className="display bv-heading">The Bracket</h2>
				<button type="button" className="btn-ghost btn-small" onClick={onClose}>
					Close
				</button>
			</div>
			<div className="bv-scroll">
				<div className="bv-grid">
					{rounds.map((bouts, r) => (
						<div className="bv-col" key={r}>
							<div className="bv-col__head">{ROUND_NAMES[r]}</div>
							<div className="bv-col__bouts">
								{bouts.map((bout, i) => (
									<BoutBox bout={bout} key={i} />
								))}
							</div>
						</div>
					))}
					<div className="bv-col">
						<div className="bv-col__head">Champion</div>
						<div className="bv-col__bouts">
							<div className={champ ? "bv-champ bv-champ--crowned" : "bv-champ"}>
								{champ ? champ.title : "?"}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
