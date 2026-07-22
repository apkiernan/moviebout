<!-- Social meta for the prerendered game pages. This lives here rather than
     app.html so the share route can serve its own per-champion tags without
     these shadowing them — crawlers honor the first og:* tag they meet. -->
<script lang="ts">
	import { CANONICAL_ORIGIN } from "$lib/site";

	let { children } = $props();

	const title = "What to Watch — The Date-Night Bracket";
	const description =
		"Sixteen contenders enter, one leaves — on your TV. Draw a bracket of movies or shows, vote head-to-head, watch the winner.";
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="What to Watch" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="{CANONICAL_ORIGIN}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="What to Watch — a lit-up theater marquee reading “Sixteen movies enter. One leaves — on your TV.”"
	/>
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="{CANONICAL_ORIGIN}/og.png" />
</svelte:head>

{@render children()}
