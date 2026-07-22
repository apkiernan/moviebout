<script lang="ts">
	import "@fontsource/anton/index.css";
	import "@fontsource/archivo/400.css";
	import "@fontsource/archivo/600.css";
	import "@fontsource/archivo/700.css";
	import "../app.css";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import BracketView from "$lib/components/BracketView.svelte";
	import { game } from "$lib/game.svelte";

	let { children } = $props();

	const onHome = $derived(page.url.pathname === "/");
	const onPlay = $derived(page.url.pathname === "/play");

	function goHome() {
		game.showBracket = false;
		goto("/");
	}
</script>

<div class="app">
	{#if !onHome}
		<header class="topbar">
			<button type="button" class="brand" onclick={goHome}>Moviebout</button>
			{#if onPlay && game.rounds}
				<div class="topbar__actions">
					<button
						type="button"
						class="btn-ghost btn-small"
						onclick={() => (game.showBracket = true)}
					>
						See the bracket
					</button>
					<button
						type="button"
						class="btn-ghost btn-small"
						onclick={() => game.undo()}
						disabled={game.history.length === 0}
					>
						Undo last pick
					</button>
				</div>
			{/if}
		</header>
	{/if}

	{@render children()}

	{#if game.showBracket && game.rounds}
		<BracketView rounds={game.rounds} onclose={() => (game.showBracket = false)} />
	{/if}
</div>
