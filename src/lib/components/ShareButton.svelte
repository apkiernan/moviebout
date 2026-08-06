<!-- Shares the champion via the native share sheet, falling back to copying to
     the clipboard. The link is a /share/[code] URL carrying the whole bracket
     (ADR 0003), so the recipient sees this exact result. -->
<script lang="ts">
	import { track } from "$lib/analytics";
	import type { Movie } from "$lib/movies";

	let { champion, sharePath }: { champion: Movie; sharePath: string } = $props();

	let copied = $state(false);
	let timer: number | undefined;

	$effect(() => () => window.clearTimeout(timer));

	async function share() {
		const year = champion.year ? ` (${champion.year})` : "";
		const text = `🏆 Tonight we're watching ${champion.title}${year} — it survived a 16-movie bracket.`;
		const url = window.location.origin + sharePath;
		let method: "native" | "clipboard";
		try {
			if (navigator.share) {
				method = "native";
				await navigator.share({ text, url });
			} else {
				method = "clipboard";
				await navigator.clipboard.writeText(`${text} ${url}`);
				copied = true;
				window.clearTimeout(timer);
				timer = window.setTimeout(() => (copied = false), 2000);
			}
			// Recorded only on success, so a dismissed share sheet doesn't count
			// as a share. Pair with shared_bracket_opened to see what links do.
			track("champion_shared", { method });
		} catch {
			// share sheet dismissed, or clipboard unavailable — nothing to clean up
		}
	}
</script>

<button type="button" class="btn-primary" onclick={share}>
	{copied ? "Copied!" : "Share the result"}
</button>
