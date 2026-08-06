<script lang="ts">
  import { track } from "$lib/analytics";
  import type { Bout } from "$lib/bracket";
  import TicketCard from "./TicketCard.svelte";

  interface Props {
    bout: Bout;
    ondecide: (side: "a" | "b") => void;
    /** Pauses clicks and arrow keys, e.g. while the bracket overlay is open. */
    inputLocked?: boolean;
  }

  let { bout, ondecide, inputLocked = false }: Props = $props();

  const DECIDE_DELAY_MS = 850;
  const COIN_TOGGLES = 9;
  const COIN_STEP_MS = 110;

  let decided = $state<"a" | "b" | null>(null);
  let coinSide = $state<"a" | "b" | null>(null);
  const timers: number[] = [];

  const locked = $derived(decided !== null || coinSide !== null || inputLocked);

  $effect(() => () => timers.forEach((t) => window.clearTimeout(t)));

  function pick(side: "a" | "b") {
    if (locked) return;
    decided = side;
    timers.push(window.setTimeout(() => ondecide(side), DECIDE_DELAY_MS));
  }

  function flipCoin() {
    if (locked) return;
    track("coin_flipped");
    const final: "a" | "b" = Math.random() < 0.5 ? "a" : "b";
    for (let i = 0; i < COIN_TOGGLES; i++) {
      timers.push(
        window.setTimeout(
          () => (coinSide = i % 2 === 0 ? "a" : "b"),
          i * COIN_STEP_MS,
        ),
      );
    }
    timers.push(
      window.setTimeout(
        () => {
          coinSide = null;
          decided = final;
          timers.push(
            window.setTimeout(() => ondecide(final), DECIDE_DELAY_MS),
          );
        },
        COIN_TOGGLES * COIN_STEP_MS + 140,
      ),
    );
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") pick("a");
    if (e.key === "ArrowRight") pick("b");
  }

  const stateFor = (side: "a" | "b") =>
    decided === null ? "idle" : decided === side ? "winner" : "loser";
</script>

<svelte:window onkeydown={onKey} />

{#if bout.a && bout.b}
  <div class="matchup">
    <TicketCard
      movie={bout.a}
      state={stateFor("a")}
      highlight={coinSide === "a"}
      disabled={locked}
      onpick={() => pick("a")}
    />
    <div class="vs" aria-hidden="true"><span>VS</span></div>
    <TicketCard
      movie={bout.b}
      state={stateFor("b")}
      highlight={coinSide === "b"}
      disabled={locked}
      onpick={() => pick("b")}
    />
    <div class="matchup__coin">
      <button
        type="button"
        class="btn-ghost btn-small"
        onclick={flipCoin}
        disabled={locked}
      >
        Can’t agree? Flip a coin
      </button>
    </div>
  </div>
{/if}
