import { error } from "@sveltejs/kit";
import type { MovieList } from "$lib/movies";
import { decodeShare, resolveShare } from "$lib/share";
import type { PageServerLoad } from "./$types";

// The one route rendered at request time (ADR 0003): a share token names a
// bracket the prerenderer can't enumerate. Everything it needs is the token
// plus the baked /lists.json asset — no TMDB access, no key, at runtime.
export const prerender = false;

type LoadEvent = Parameters<PageServerLoad>[0];

async function fetchBakedLists(event: LoadEvent): Promise<MovieList[]> {
	// Deployed, the built site's files hang off the ASSETS binding
	// (wrangler.jsonc); in `vite dev` there is no platform and event.fetch
	// runs the /lists.json endpoint live instead.
	const assets = event.platform?.env?.ASSETS;
	const res = assets
		? await assets.fetch(new URL("/lists.json", event.url.origin))
		: await event.fetch("/lists.json");
	if (!res.ok) throw new Error(`lists.json returned ${res.status}`);
	return res.json();
}

// Fetched and parsed once per worker isolate, not per share view.
let listsPromise: Promise<MovieList[]> | undefined;

function bakedLists(event: LoadEvent): Promise<MovieList[]> {
	listsPromise ??= fetchBakedLists(event).catch((err) => {
		listsPromise = undefined;
		throw err;
	});
	return listsPromise;
}

export const load: PageServerLoad = async (event) => {
	const decoded = decodeShare(event.params.code);
	if (!decoded) error(404, "This link doesn't decode to a bracket.");
	const shared = resolveShare(decoded, await bakedLists(event));
	if (!shared) error(404, "This link doesn't decode to a finished bracket.");

	// A token is immutable, so the edge may cache the page; an hour keeps
	// poster enrichment reasonably fresh across data refreshes.
	event.setHeaders({ "cache-control": "public, max-age=3600" });
	return { shared };
};
