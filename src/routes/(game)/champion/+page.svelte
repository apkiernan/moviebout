<script lang="ts">
	import { goto } from "$app/navigation";
	import Marquee from "$lib/components/Marquee.svelte";
	import ShareButton from "$lib/components/ShareButton.svelte";
	import { game } from "$lib/game.svelte";
	import { encodeShare } from "$lib/share";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// The crowned bracket, packed into a URL the recipient can replay (ADR 0003).
	const sharePath = $derived(
		game.champ && game.rounds ? `/share/${encodeShare(game.listId, game.rounds)}` : null,
	);

	// Landing here without a crowned bracket (deep link, reload) rehydrates
	// the saved one and sends an unfinished bracket back to /play.
	$effect(() => {
		if (game.champ) return;
		if (game.restoreFromSave()) {
			if (!game.champ) goto("/play", { replaceState: true });
		} else {
			goto("/", { replaceState: true });
		}
	});

	function newCard() {
		game.scrapSave();
		goto("/");
	}
</script>

{#if game.champ}
	{@const champ = game.champ}
	<main class="champion">
		<p class="eyebrow">And your winner is</p>
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
		<div class="row champion__actions">
			{#if sharePath}
				<ShareButton champion={champ} {sharePath} />
			{/if}
			<a
				class="btn-ghost"
				href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(champ.title)}`}
				target="_blank"
				rel="noreferrer"
			>
				Where to stream it
			</a>
		</div>
		<div class="row champion__actions">
			<button type="button" class="btn-ghost" onclick={() => (game.showBracket = true)}>
				See the bracket
			</button>
			<button
				type="button"
				class="btn-ghost"
				onclick={() => game.undo()}
				disabled={game.history.length === 0}
			>
				Undo the final
			</button>
			<button
				type="button"
				class="btn-ghost"
				onclick={() => game.drawNewField(data.lists, game.listId, "run_it_back")}
			>
				Run it back
			</button>
		</div>
		<button type="button" class="btn-ghost btn-small champion__new" onclick={newCard}>
			Pick a new card
		</button>
	</main>
{/if}
