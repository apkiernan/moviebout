import { useEffect, useRef, useState } from "react";
import type { Bout } from "../bracket";
import { TicketCard } from "./TicketCard";

interface Props {
	bout: Bout;
	onDecide: (side: "a" | "b") => void;
	/** Pauses clicks and arrow keys, e.g. while the bracket overlay is open. */
	inputLocked?: boolean;
}

const DECIDE_DELAY_MS = 850;
const COIN_TOGGLES = 9;
const COIN_STEP_MS = 110;

/** One head-to-head bout: two tickets, a VS burst, and a coin for deadlocks. */
export function Matchup({ bout, onDecide, inputLocked = false }: Props) {
	const [decided, setDecided] = useState<"a" | "b" | null>(null);
	const [coinSide, setCoinSide] = useState<"a" | "b" | null>(null);
	const timers = useRef<number[]>([]);

	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((t) => window.clearTimeout(t));
	}, []);

	const locked = decided !== null || coinSide !== null || inputLocked;

	function pick(side: "a" | "b") {
		if (locked) return;
		setDecided(side);
		timers.current.push(window.setTimeout(() => onDecide(side), DECIDE_DELAY_MS));
	}

	function flipCoin() {
		if (locked) return;
		const final: "a" | "b" = Math.random() < 0.5 ? "a" : "b";
		for (let i = 0; i < COIN_TOGGLES; i++) {
			timers.current.push(
				window.setTimeout(() => setCoinSide(i % 2 === 0 ? "a" : "b"), i * COIN_STEP_MS),
			);
		}
		timers.current.push(
			window.setTimeout(
				() => {
					setCoinSide(null);
					setDecided(final);
					timers.current.push(window.setTimeout(() => onDecide(final), DECIDE_DELAY_MS));
				},
				COIN_TOGGLES * COIN_STEP_MS + 140,
			),
		);
	}

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "ArrowLeft") pick("a");
			if (e.key === "ArrowRight") pick("b");
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (!bout.a || !bout.b) return null;

	const stateFor = (side: "a" | "b") =>
		decided === null ? "idle" : decided === side ? "winner" : "loser";

	return (
		<div className="matchup">
			<TicketCard
				movie={bout.a}
				state={stateFor("a")}
				highlight={coinSide === "a"}
				disabled={locked}
				onPick={() => pick("a")}
			/>
			<div className="vs" aria-hidden="true">
				<span>VS</span>
			</div>
			<TicketCard
				movie={bout.b}
				state={stateFor("b")}
				highlight={coinSide === "b"}
				disabled={locked}
				onPick={() => pick("b")}
			/>
			<div className="matchup__coin">
				<button type="button" className="btn-ghost btn-small" onClick={flipCoin} disabled={locked}>
					Can’t agree? Flip a coin
				</button>
			</div>
		</div>
	);
}
