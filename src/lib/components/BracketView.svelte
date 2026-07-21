<script lang="ts">
	import { champion, roundName, type Bout, type Rounds } from "$lib/bracket";
	import type { Movie } from "$lib/movies";

	let { rounds, onclose }: { rounds: Rounds; onclose: () => void } = $props();

	const champ = $derived(champion(rounds));

	function onKey(e: KeyboardEvent) {
		if (e.key === "Escape") onclose();
	}
</script>

{#snippet slot(movie: Movie | null, won: boolean, lost: boolean)}
	<div class={["bv-slot", won && "bv-slot--won", lost && "bv-slot--lost"]}>
		{#if movie}
			<span class="bv-slot__name">{movie.title}</span>
		{:else}
			<span class="bv-slot__tbd">TBD</span>
		{/if}
	</div>
{/snippet}

{#snippet boutBox(bout: Bout)}
	<div class="bv-bout">
		{@render slot(bout.a, bout.winner === "a", bout.winner === "b")}
		{@render slot(bout.b, bout.winner === "b", bout.winner === "a")}
	</div>
{/snippet}

<svelte:window onkeydown={onKey} />

<div class="bv-overlay" role="dialog" aria-label="Tournament bracket">
	<div class="bv-top">
		<h2 class="display bv-heading">The Bracket</h2>
		<button type="button" class="btn-ghost btn-small" onclick={onclose}>Close</button>
	</div>
	<div class="bv-scroll">
		<div class="bv-grid">
			{#each rounds as bouts, r}
				<div class="bv-col">
					<div class="bv-col__head">{roundName(rounds, r)}</div>
					<div class="bv-col__bouts">
						{#each bouts as bout}
							{@render boutBox(bout)}
						{/each}
					</div>
				</div>
			{/each}
			<div class="bv-col">
				<div class="bv-col__head">Champion</div>
				<div class="bv-col__bouts">
					<div class={champ ? "bv-champ bv-champ--crowned" : "bv-champ"}>
						{champ ? champ.title : "?"}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
