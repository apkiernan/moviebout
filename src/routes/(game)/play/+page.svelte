<script lang="ts">
	import { goto } from "$app/navigation";
	import { roundName } from "$lib/bracket";
	import Matchup from "$lib/components/Matchup.svelte";
	import { game } from "$lib/game.svelte";

	// Landing here without a bracket in memory (deep link, reload)
	// rehydrates the saved one, or goes back to the lobby.
	$effect(() => {
		if (!game.rounds) {
			if (!game.restoreFromSave()) goto("/", { replaceState: true });
		} else if (game.champ) {
			goto("/champion");
		}
	});
</script>

{#if game.rounds && game.cur && game.progress}
	<main class="play">
		<p class="eyebrow play__round">
			{roundName(game.rounds, game.cur.round)} · Bout {game.progress.bout} of {game.progress.of}
		</p>
		<p class="play__hint">Tap the ticket you’d rather watch</p>
		{#key game.boutKey}
			<Matchup
				bout={game.rounds[game.cur.round][game.cur.index]}
				ondecide={(side) => game.decide(side)}
				inputLocked={game.showBracket}
			/>
		{/key}
		<div
			class="progress"
			aria-label={`${game.decidedCount} of ${game.totalCount} bouts decided`}
		>
			{#each { length: game.totalCount }, i}
				<span
					class={i < game.decidedCount
						? "tick tick--done"
						: i === game.decidedCount
							? "tick tick--now"
							: "tick"}
				></span>
			{/each}
		</div>
	</main>
{/if}
