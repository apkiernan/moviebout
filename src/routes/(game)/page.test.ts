import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Movie, MovieList } from "$lib/movies";
import Page from "./+page.svelte";

// Server-side render of the home screen — the same render the prerenderer
// does at build time — with every lineup present in the markup.

function movie(i: number): Movie {
  return { title: `Movie ${i}`, year: 1950 + i, blurb: "" };
}

function list(id: string, name: string): MovieList {
  return {
    id,
    name,
    tagline: `Tagline for ${id}`,
    movies: Array.from({ length: 16 }, (_, i) => movie(i)),
  };
}

describe("home page", () => {
  it("renders the marquee and every lineup", () => {
    const lists = [
      list("all-time", "Best of All Time"),
      list("horror", "Horror"),
    ];
    const { body } = render(Page, { props: { data: { lists }, params: {} } });
    expect(body).toContain("Moviebout");
    for (const l of lists) {
      expect(body).toContain(l.name);
    }
  });
});
