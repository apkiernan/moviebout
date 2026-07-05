import { useEffect, useState } from "react";
import type { Movie } from "../data/movies";

/** Shares the champion via the native share sheet, falling back to copying to the clipboard. */
export function ShareButton({ champion }: { champion: Movie }) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timer);
	}, [copied]);

	async function share() {
		const year = champion.year ? ` (${champion.year})` : "";
		const text = `🏆 Tonight we're watching ${champion.title}${year} — it survived a 16-movie bracket.`;
		const url = window.location.origin;
		try {
			if (navigator.share) {
				await navigator.share({ text, url });
			} else {
				await navigator.clipboard.writeText(`${text} ${url}`);
				setCopied(true);
			}
		} catch {
			// share sheet dismissed, or clipboard unavailable — nothing to clean up
		}
	}

	return (
		<button type="button" className="btn-primary" onClick={share}>
			{copied ? "Copied!" : "Share the result"}
		</button>
	);
}
