<script lang="ts">
	import type { Movie } from "$lib/movies";

	type TicketState = "idle" | "winner" | "loser";

	interface Props {
		movie: Movie;
		state?: TicketState;
		highlight?: boolean;
		disabled?: boolean;
		onpick?: () => void;
	}

	let { movie, state = "idle", highlight = false, disabled = false, onpick }: Props = $props();

	function serial(movie: Movie): string {
		let h = 0;
		const s = movie.title + movie.year;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
		return String(h % 1_000_000).padStart(6, "0");
	}
</script>

<button
	type="button"
	class={["ticket", `ticket--${state}`, movie.poster && "ticket--art", highlight && "ticket--coin"]}
	onclick={onpick}
	{disabled}
>
	<span class="ticket__strip" aria-hidden="true">Admit One</span>
	{#if movie.poster}
		<img class="ticket__poster" src={movie.poster} alt="" loading="lazy" decoding="async" />
	{/if}
	<span class="ticket__body">
		<span class="ticket__title">{movie.title}</span>
		{#if movie.year > 0}<span class="ticket__year">{movie.year}</span>{/if}
		{#if movie.blurb}<span class="ticket__blurb">{movie.blurb}</span>{/if}
		{#if movie.cast && movie.cast.length > 0}
			<span class="ticket__cast">{movie.cast.join(" · ")}</span>
		{/if}
	</span>
	<span class="ticket__serial" aria-hidden="true">No. {serial(movie)} · General Admission</span>
	{#if state === "winner"}
		<span class="ticket__stamp" aria-hidden="true">Winner</span>
	{/if}
</button>
