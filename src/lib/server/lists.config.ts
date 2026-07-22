// Query-defined lists (ADR 0001). Each entry becomes a lineup in the app,
// materialized from TMDB by $lib/server/tmdb.ts when the site builds. Every
// list is grounded in a TMDB chart or discover query — no hand-picked lineups.
//
// Each list needs an `id`, `name`, `tagline`, and either:
//   discover: params for TMDB /discover/movie or /discover/tv — e.g.
//     { with_genres: "horror", "vote_count.gte": 1000, sort_by:
//     "vote_average.desc" }. Genre names are resolved to TMDB ids for the
//     list's media type ("," = and, "|" = or). One pseudo-sort exists:
//     sort_by: "weighted_rating.desc" ranks a merged candidate pool by the
//     vote-count-aware Bayesian rating in $lib/server/rank.ts, so widely seen
//     titles outrank niche darlings with inflated raw averages.
//   chart: a TMDB chart — "top_rated" or "popular" for either media,
//     "now_playing" for movies, "on_the_air"/"airing_today" for TV.
// `media` picks the catalog (default "movie"). The two are separate TMDB
// worlds: different discover params (`first_air_date.*` not
// `primary_release_date.*`, `with_type` for series type, `with_runtime` means
// episode runtime), different genre taxonomies (TV has no Horror/Romance/
// Thriller, but has combined "Sci-Fi & Fantasy"), and far lower vote counts
// (the TV prior in rank.ts).
// `limit` caps the list (default 24); the app draws 16, so keep it above that.

export interface ListDef {
	id: string;
	media?: "movie" | "tv";
	name: string;
	tagline: string;
	limit?: number;
	chart?: "top_rated" | "popular" | "now_playing" | "on_the_air" | "airing_today";
	discover?: Record<string, string | number>;
}

// The weighted crowd rating with three guards: a vote floor so brand-new
// releases with inflated early ratings don't outrank canon, a runtime floor so
// animated shorts (Paperman, Bao, ...) don't land in a movie-night bracket,
// and a 1980 release floor so genre brackets stay recognizable — the older
// canon gets its own "classics" list instead of seeding every genre. Genre
// lists share this shape.
// The TV counterpart of topRatedIn, with different guards. `with_type: "2|4"`
// (miniseries or scripted) plays the role the runtime floor plays for movies,
// keeping talk, news, and reality out of the bracket — soaps and daytime fare
// never clear the vote floor. `without_genres: "animation"` keeps every genre
// lane from filling with anime, whose engaged-fan vote counts and ratings
// dwarf live-action TV on TMDB; animation gets its own list instead, exactly
// as the pre-1980 canon gets "classics". The 1000-vote floor is the TV analog
// of the movies' 3000 — TV vote counts run roughly a decade lower.
const topRatedTvIn = (genres: string) => ({
	with_genres: genres,
	without_genres: "animation",
	"vote_count.gte": 1000,
	with_type: "2|4",
	sort_by: "weighted_rating.desc",
});

const topRatedIn = (genres: string) => ({
	with_genres: genres,
	"vote_count.gte": 3000,
	"with_runtime.gte": 60,
	"primary_release_date.gte": "1980-01-01",
	sort_by: "weighted_rating.desc",
});

export const LIST_DEFS: ListDef[] = [
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
			sort_by: "weighted_rating.desc",
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
			sort_by: "weighted_rating.desc",
		},
	},
	{
		// Home of the pre-1980 canon the genre lists' release floor excludes.
		id: "classics",
		name: "Classics",
		tagline: "The pre-1980 canon — Hitchcock to Star Wars",
		limit: 48,
		discover: {
			"primary_release_date.lte": "1979-12-31",
			"vote_count.gte": 3000,
			"with_runtime.gte": 60,
			sort_by: "weighted_rating.desc",
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
			sort_by: "weighted_rating.desc",
		},
	},
	{
		// 2000 votes ≈ TV's enduring canon, the analog of the movies' 10k floor.
		// No animation exclusion here: the all-time card is the crowd's verdict,
		// exclusions are for keeping genre lanes distinct.
		id: "tv-all-time",
		media: "tv",
		name: "Best TV of All Time",
		tagline: "The shows the crowd rates highest — the small-screen canon",
		limit: 64,
		discover: {
			"vote_count.gte": 2000,
			with_type: "2|4",
			sort_by: "weighted_rating.desc",
		},
	},
	{
		// Miniseries have small but devoted audiences: a 250-vote floor admits
		// the pool, the weighted rating still puts the widely seen ones on top.
		id: "limited-series",
		media: "tv",
		name: "Limited Series",
		tagline: "One season, no filler — the best complete stories",
		limit: 32,
		discover: {
			"vote_count.gte": 250,
			with_type: "2",
			sort_by: "weighted_rating.desc",
		},
	},
	{
		id: "tv-drama",
		media: "tv",
		name: "TV Drama",
		tagline: "Prestige heavyweights, ranked by the crowd",
		limit: 48,
		discover: topRatedTvIn("drama"),
	},
	{
		id: "tv-comedy",
		media: "tv",
		name: "TV Comedy",
		tagline: "The sitcoms and satires the crowd rates highest",
		limit: 48,
		discover: topRatedTvIn("comedy"),
	},
	{
		// TV has no separate horror/sci-fi genres — "Sci-Fi & Fantasy" is the
		// combined TMDB lane, and it's where the genre's best shows live.
		id: "tv-scifi-fantasy",
		media: "tv",
		name: "TV Sci-Fi & Fantasy",
		tagline: "Other worlds on the small screen, by the numbers",
		limit: 48,
		discover: topRatedTvIn("sci-fi & fantasy"),
	},
	{
		id: "tv-crime",
		media: "tv",
		name: "TV Crime",
		tagline: "Heists, cartels, and detectives — ranked by the crowd",
		limit: 48,
		discover: topRatedTvIn("crime"),
	},
	{
		// The home the genre lists' animation exclusion points to — anime and
		// adult animation compete in their own lane.
		id: "tv-animation",
		media: "tv",
		name: "Animation & Anime",
		tagline: "The top-rated animated series on TMDB",
		limit: 48,
		discover: {
			with_genres: "animation",
			"vote_count.gte": 1000,
			with_type: "2|4",
			sort_by: "weighted_rating.desc",
		},
	},
];
