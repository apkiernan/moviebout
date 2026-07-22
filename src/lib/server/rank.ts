// Ranks discover results for `sort_by: "weighted_rating.desc"` lists (see
// $lib/server/lists.config.ts). TMDB's raw vote_average rewards
// niche-but-beloved: a film with 4k votes and an 8.5 outranks one with 60k
// votes and an 8.2, filling "rated best" lineups with films most players have
// never heard of. Shrinking each rating toward a prior mean — weakly for
// widely voted films, strongly for barely-qualified ones — folds vote count
// (the recognizability signal) into the order instead of using it only as an
// entry gate.

// IMDb's Top 250 uses the same formula with m = 25k; 10k fits TMDB's smaller
// movie vote counts and matches the all-time list's "enduring canon" floor.
// TV vote counts run roughly an order of magnitude lower again (Breaking Bad
// sits under 20k where The Dark Knight has 30k+), so TV lists pass their own
// prior — 10k would shrink every show to the mean and rank by votes alone.
export const PRIOR_VOTES = { movie: 10000, tv: 2000 } as const;

// Deliberately below the ~7.5+ ratings that top a genre query, so a
// lightly-voted title must be exceptional to hold a bracket seat.
const PRIOR_MEAN = 7.0;

export interface Rated {
	vote_average?: number;
	vote_count?: number;
}

/**
 * Bayesian weighted rating: `v/(v+m)·R + m/(v+m)·C`. Approaches the raw
 * rating as votes grow; approaches PRIOR_MEAN as they vanish.
 */
export function weightedRating(
	{ vote_average = 0, vote_count = 0 }: Rated,
	priorVotes: number = PRIOR_VOTES.movie,
): number {
	return (
		(vote_count / (vote_count + priorVotes)) * vote_average +
		(priorVotes / (vote_count + priorVotes)) * PRIOR_MEAN
	);
}
