<!-- A bulb-lit theater marquee frame. -->
<script lang="ts">
	import type { Snippet } from "svelte";

	let { big = false, children }: { big?: boolean; children: Snippet } = $props();
</script>

<div class={big ? "marquee marquee--big" : "marquee"}>{@render children()}</div>
