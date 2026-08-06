<script lang="ts">
	import { goto } from "$app/navigation";
	import { game } from "$lib/game.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const list = $derived(game.allLists(data.lists).find((l) => l.id === game.listId));

	// A drawn field lives only in memory — landing here without one
	// (deep link, reload) goes back to the lobby.
	$effect(() => {
		if (game.field.length === 0) goto("/", { replaceState: true });
	});
</script>

{#if list && game.field.length > 0}
	<main class="field">
		<p class="eyebrow">Tonight’s card · {list.name}</p>
		<h1 class="display field__title">The Field of 16</h1>
		<div class="field__grid">
			{#each game.field as movie (movie.title + movie.year)}
				<div class="mini-ticket">
					{#if movie.poster}
						<img
							class="mini-ticket__poster"
							src={movie.poster}
							alt=""
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<span class="mini-ticket__placeholder" aria-hidden="true">
							{movie.title.replace(/^(the|a|an) /i, "").charAt(0)}
						</span>
					{/if}
					<span class="mini-ticket__text">
						<span class="mini-ticket__title">{movie.title}</span>
						{#if movie.year > 0}<span class="mini-ticket__year">{movie.year}</span>{/if}
					</span>
				</div>
			{/each}
		</div>
		<div class="row field__actions">
			<button
				type="button"
				class="btn-ghost"
				onclick={() => game.drawNewField(data.lists, game.listId, "shuffle")}
			>
				Shuffle again
			</button>
			<button type="button" class="btn-primary" onclick={() => game.startTournament()}>
				Start the tournament
			</button>
		</div>
	</main>
{/if}
