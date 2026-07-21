<!-- Shares the champion via the native share sheet, falling back to copying to
     the clipboard. The link is a /share/[code] URL carrying the whole bracket
     (ADR 0003), so the recipient sees this exact result. -->
<script lang="ts">
	import type { Movie } from "$lib/movies";

	let { champion, sharePath }: { champion: Movie; sharePath: string } = $props();

	let copied = $state(false);
	let timer: number | undefined;

	$effect(() => () => window.clearTimeout(timer));

	async function share() {
		const year = champion.year ? ` (${champion.year})` : "";
		const text = `🏆 Tonight we're watching ${champion.title}${year} — it survived a 16-movie bracket.`;
		const url = window.location.origin + sharePath;
		try {
			if (navigator.share) {
				await navigator.share({ text, url });
			} else {
				await navigator.clipboard.writeText(`${text} ${url}`);
				copied = true;
				window.clearTimeout(timer);
				timer = window.setTimeout(() => (copied = false), 2000);
			}
		} catch {
			// share sheet dismissed, or clipboard unavailable — nothing to clean up
		}
	}
</script>

<button type="button" class="btn-primary" onclick={share}>
	{copied ? "Copied!" : "Share the result"}
</button>
