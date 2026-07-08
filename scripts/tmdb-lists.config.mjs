// Query-defined lists (ADR 0001). Each entry becomes a lineup in the app when
// scripts/fetch-tmdb.mjs runs, written to src/data/generated.ts. Hand-picked
// lists in src/data/movies.ts are untouched.
//
// Each list needs an `id`, `name`, `tagline`, and either:
//   discover: params for TMDB /discover/movie — e.g. { with_genres: "horror",
//     "vote_count.gte": 1000, sort_by: "vote_average.desc" }. Genre names are
//     resolved to TMDB ids ("," = and, "|" = or).
//   chart: a TMDB movie chart — "top_rated", "popular", or "now_playing".
// `limit` caps the list (default 24); the app draws 16, so keep it above that.

export default [
	{
		id: "best-of-2025",
		name: "Best of 2025",
		tagline: "Last year's releases, ranked by the crowd",
		limit: 24,
		discover: {
			primary_release_year: 2025,
			"vote_count.gte": 500,
			sort_by: "vote_average.desc",
		},
	},
];
