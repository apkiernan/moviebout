import { json } from "@sveltejs/kit";
import { fetchMovieLists } from "$lib/server/tmdb";

// Prerendered into a static /lists.json asset. The share route (ADR 0003)
// renders at request time and resolves the TMDB ids in a share token against
// this file — baked data, no TMDB call, no key at runtime.
export const prerender = true;

export async function GET() {
	return json(await fetchMovieLists());
}
