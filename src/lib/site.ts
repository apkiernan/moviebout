// The canonical origin for absolute URLs baked into prerendered markup —
// og:image and friends refuse relative paths. moviebout.com serves the same
// build; flickmadness.com is canonical while the name contest runs. Routes
// rendered at request time (the share page) use the real request origin
// instead.
export const CANONICAL_ORIGIN = "https://flickmadness.com";
