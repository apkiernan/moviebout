<script lang="ts">
	import { page } from "$app/state";
	import BracketView from "$lib/components/BracketView.svelte";
	import Marquee from "$lib/components/Marquee.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const shared = $derived(data.shared);
	const champ = $derived(shared.champion);
	const lineup = $derived(shared.listName ?? "a hand-picked card");
	let showBracket = $state(false);

	const shareTitle = $derived(
		`🏆 ${champ.title}${champ.year ? ` (${champ.year})` : ""} won the ${
			champ.media === "tv" ? "TV" : "movie"
		} bracket`,
	);
	const shareDescription = $derived(
		`${shared.field.length} contenders from ${lineup} went head-to-head; this one left. ` +
			"See the full bracket, then run your own.",
	);
	const fallbackImage = $derived(`${page.url.origin}/og.png`);
</script>

<svelte:head>
	<title>{shareTitle} — What to Watch</title>
	<meta name="description" content={shareDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="What to Watch" />
	<meta property="og:title" content={shareTitle} />
	<meta property="og:description" content={shareDescription} />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:image" content={champ.poster ?? fallbackImage} />
	{#if champ.poster}
		<meta property="og:image:alt" content="Poster for {champ.title}" />
	{/if}
	<!-- Posters are portrait, so the small summary card crops less than the wide one. -->
	<meta name="twitter:card" content={champ.poster ? "summary" : "summary_large_image"} />
	<meta name="twitter:title" content={shareTitle} />
	<meta name="twitter:description" content={shareDescription} />
	<meta name="twitter:image" content={champ.poster ?? fallbackImage} />
</svelte:head>

<main class="champion">
	<p class="eyebrow">Movie night verdict — shared with you</p>
	<Marquee big>
		<p class="now-showing">Now Showing</p>
		<div class="champion__content">
			{#if champ.poster}
				<img class="champion__poster" src={champ.poster} alt="" />
			{/if}
			<div class="champion__text">
				<h1 class="display champion__title">{champ.title}</h1>
				<p class="champion__meta">
					{[champ.year, champ.blurb].filter(Boolean).join(" · ")}
				</p>
				{#if champ.cast && champ.cast.length > 0}
					<p class="champion__cast">Starring {champ.cast.join(", ")}</p>
				{/if}
			</div>
		</div>
	</Marquee>
	<p class="share-story">
		{shared.field.length} contenders from {lineup} went head-to-head. This one left.
	</p>
	<div class="row champion__actions">
		<a class="btn-primary" href="/">Run your own bracket</a>
		<button type="button" class="btn-ghost" onclick={() => (showBracket = true)}>
			See the full bracket
		</button>
		<a
			class="btn-ghost"
			href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(champ.title)}`}
			target="_blank"
			rel="noreferrer"
		>
			Where to stream it
		</a>
	</div>
</main>

{#if showBracket}
	<BracketView rounds={shared.rounds} onclose={() => (showBracket = false)} />
{/if}
