<script lang="ts">
	import { goto } from "$app/navigation";
	import { currentBout, roundName, roundProgress } from "$lib/bracket";
	import Marquee from "$lib/components/Marquee.svelte";
	import { CUSTOM_LIST_ID } from "$lib/customCard";
	import { game, loadSave } from "$lib/game.svelte";
	import { mediaOf } from "$lib/movies";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const allLists = $derived(game.allLists(data.lists));
	// The dropdown groups by medium; the hand-picked card (untyped) gets its own group.
	const listGroups = $derived(
		[
			{ label: "Movies", lists: allLists.filter((l) => l.id !== CUSTOM_LIST_ID && mediaOf(l) === "movie") },
			{ label: "TV Shows", lists: allLists.filter((l) => mediaOf(l) === "tv") },
			{ label: "Your Card", lists: allLists.filter((l) => l.id === CUSTOM_LIST_ID) },
		].filter((g) => g.lists.length > 0),
	);

	let listId = $state("");
	// The last-played list survives a trip back home; otherwise open on the first lineup.
	$effect.pre(() => {
		if (!allLists.some((l) => l.id === listId)) {
			listId = allLists.some((l) => l.id === game.listId) ? game.listId : data.lists[0].id;
		}
	});
	const list = $derived(allLists.find((l) => l.id === listId) ?? data.lists[0]);

	let save = $state(loadSave());

	const saveInfo = $derived.by(() => {
		const saved = save;
		if (!saved) return null;
		const savedList = allLists.find((l) => l.id === saved.listId);
		const savedCur = currentBout(saved.rounds);
		if (!savedList || !savedCur) return null;
		const progress = roundProgress(saved.rounds, savedCur.round, savedCur.index);
		return {
			listName: savedList.name,
			roundName: roundName(saved.rounds, savedCur.round),
			bout: progress.bout,
			of: progress.of,
		};
	});

	function scrap() {
		game.scrapSave();
		save = null;
	}
</script>

<main class="home">
	<Marquee big>
		<p class="eyebrow">Date night · Main event</p>
		<h1 class="display home__title">Moviebout</h1>
		<p class="home__sub">Sixteen contenders enter. One leaves — on your TV.</p>
	</Marquee>

	{#if saveInfo}
		<section class="panel resume">
			<p class="resume__text">
				A bracket is still in progress — <strong>{saveInfo.listName}</strong>,
				{saveInfo.roundName.toLowerCase()}, bout {saveInfo.bout} of {saveInfo.of}.
			</p>
			<div class="row">
				<button type="button" class="btn-primary btn-small" onclick={() => game.resume()}>
					Resume the bracket
				</button>
				<button type="button" class="btn-ghost btn-small" onclick={scrap}>Scrap it</button>
			</div>
		</section>
	{/if}

	<section class="panel card-picker">
		<p class="eyebrow">Tonight’s card</p>
		<label class="picker-label" for="list-select">Pick a lineup</label>
		<select id="list-select" class="list-select" bind:value={listId}>
			{#each listGroups as group (group.label)}
				<optgroup label={group.label}>
					{#each group.lists as l (l.id)}
						<option value={l.id}>{l.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		<p class="list-tagline">
			{list.tagline} · {list.movies.length}
			{mediaOf(list) === "tv" ? "shows" : "movies"} on the card
		</p>
		<button
			type="button"
			class="btn-primary"
			onclick={() => game.drawNewField(data.lists, listId)}
		>
			Draw the bracket
		</button>
		<button type="button" class="btn-ghost btn-small" onclick={() => goto("/builder")}>
			{game.customMovies.length > 0
				? `Edit your own card (${game.customMovies.length} titles)`
				: "Or build your own card"}
		</button>
	</section>

	<footer class="home__foot">
		16 random titles · head-to-head votes · winner gets watched
		<span class="home__tmdb">
			This product uses the <a href="https://www.themoviedb.org">TMDB</a> API but is not endorsed
			or certified by TMDB.
		</span>
	</footer>
</main>
