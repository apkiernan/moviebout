<!-- Screen for entering a hand-picked lineup, one movie per line. -->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { MIN_CARD_SIZE, parseCard, serializeCard } from "$lib/customCard";
	import { game } from "$lib/game.svelte";

	let text = $state(serializeCard(game.customMovies));
	const parsed = $derived(parseCard(text));
	const missing = $derived(MIN_CARD_SIZE - parsed.length);
</script>

<main class="builder">
	<p class="eyebrow">Bring your own movies</p>
	<h1 class="display builder__title">Build Your Card</h1>
	<section class="panel builder__panel">
		<label class="picker-label" for="card-text">
			One movie per line — “Heat (1995)” or just “Heat”
		</label>
		<textarea
			id="card-text"
			class="builder__text"
			rows={16}
			bind:value={text}
			placeholder={"Heat (1995)\nMoonstruck (1987)\nThe Fugitive (1993)\n…"}
			spellcheck="false"
		></textarea>
		<p class="builder__count" role="status">
			{parsed.length}
			{parsed.length === 1 ? "movie" : "movies"} on the card
			{missing > 0 ? ` — ${missing} more to fill a bracket` : " — ready to draw"}
		</p>
		<div class="row">
			<button type="button" class="btn-ghost" onclick={() => goto("/")}>Back to the lobby</button>
			<button
				type="button"
				class="btn-primary"
				onclick={() => game.saveCard(parsed)}
				disabled={parsed.length < MIN_CARD_SIZE}
			>
				Save &amp; draw the bracket
			</button>
		</div>
	</section>
</main>
