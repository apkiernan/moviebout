// Query-defined lists (ADR 0001). Each entry becomes a lineup in the app when
// scripts/fetch-tmdb.mjs runs, written to src/data/generated.ts. Every list is
// grounded in a TMDB chart or discover query — no hand-picked lineups.
//
// Each list needs an `id`, `name`, `tagline`, and either:
//   discover: params for TMDB /discover/movie — e.g. { with_genres: "horror",
//     "vote_count.gte": 1000, sort_by: "vote_average.desc" }. Genre names are
//     resolved to TMDB ids ("," = and, "|" = or).
//   chart: a TMDB movie chart — "top_rated", "popular", or "now_playing".
// `limit` caps the list (default 24); the app draws 16, so keep it above that.

// TMDB's crowd rating with two guards: a vote floor so brand-new releases with
// inflated early ratings don't outrank canon, and a runtime floor so animated
// shorts (Paperman, Bao, ...) don't land in a movie-night bracket. Genre lists
// share this shape.
const topRatedIn = (genres) => ({
	with_genres: genres,
	"vote_count.gte": 3000,
	"with_runtime.gte": 60,
	sort_by: "vote_average.desc",
});

export default [
	{
		// Discover instead of the top_rated chart: the chart's low built-in vote
		// floor lets rating-inflated new releases hit #1. 10k votes ≈ enduring canon
		// (IMDb's Top 250 uses a 25k floor for the same reason).
		id: "all-time",
		name: "Best of All Time",
		tagline: "The crowd's heavyweight canon — 100 undisputed greats",
		limit: 100,
		discover: {
			"vote_count.gte": 10000,
			"with_runtime.gte": 60,
			sort_by: "vote_average.desc",
		},
	},
	{
		id: "romance",
		name: "Romance",
		tagline: "The highest-rated love stories on TMDB",
		limit: 48,
		discover: topRatedIn("romance"),
	},
	{
		id: "comedy",
		name: "Comedy",
		tagline: "The funniest films, ranked by the crowd",
		limit: 48,
		discover: topRatedIn("comedy"),
	},
	{
		id: "horror",
		name: "Horror",
		tagline: "The scares the crowd rates highest",
		limit: 48,
		discover: topRatedIn("horror"),
	},
	{
		id: "scifi",
		name: "Sci-Fi",
		tagline: "The best of other worlds, by the numbers",
		limit: 48,
		discover: topRatedIn("science fiction"),
	},
	{
		id: "action",
		name: "Action",
		tagline: "The highest-rated adrenaline on TMDB",
		limit: 48,
		discover: topRatedIn("action"),
	},
	{
		id: "thriller",
		name: "Thriller",
		tagline: "Edge-of-the-seat picks, ranked by the crowd",
		limit: 48,
		discover: topRatedIn("thriller"),
	},
	{
		id: "animation",
		name: "Animation",
		tagline: "The top-rated animated films on TMDB",
		limit: 48,
		discover: topRatedIn("animation"),
	},
	{
		id: "nineties",
		name: "The Nineties",
		tagline: "1990–1999, ranked by the crowd",
		limit: 48,
		discover: {
			"primary_release_date.gte": "1990-01-01",
			"primary_release_date.lte": "1999-12-31",
			"vote_count.gte": 1000,
			"with_runtime.gte": 60,
			sort_by: "vote_average.desc",
		},
	},
	{
		// "Feel-good" isn't a TMDB genre and its keywords cover too few films,
		// so this is grounded as comedy AND family, rated high by the crowd.
		id: "feelgood",
		name: "Feel-Good & Family",
		tagline: "Comedy-family crowd-pleasers, guaranteed good mood",
		limit: 48,
		discover: topRatedIn("comedy,family"),
	},
	{
		id: "best-of-2025",
		name: "Best of 2025",
		tagline: "Last year's releases, ranked by the crowd",
		limit: 24,
		discover: {
			primary_release_year: 2025,
			"vote_count.gte": 500,
			"with_runtime.gte": 60,
			sort_by: "vote_average.desc",
		},
	},
];
