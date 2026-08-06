// Product analytics via PostHog. The site is prerendered and served as static
// assets from Cloudflare (ADR 0001), so there's no request-time server to
// instrument — this all runs in the browser, started once from the root layout.
//
// Analytics stays off unless PUBLIC_POSTHOG_KEY is set, so dev, tests, forks,
// and PR builds send nothing without anyone opting out.
import { browser } from "$app/environment";
import { PUBLIC_POSTHOG_KEY } from "$env/static/public";
import type { PostHog } from "posthog-js";

/**
 * PostHog US cloud. Swap to https://eu.i.posthog.com if the project ever moves
 * to EU data residency — a project only exists in one region, and events sent
 * to the wrong one are accepted and then silently dropped.
 */
const POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * The share of visitors whose events are sent. Sampling is per distinct id,
 * not per event: a visitor is either fully tracked or fully skipped, so a
 * bracket never shows up half-finished and funnel drop-off stays honest.
 *
 * Reading the numbers: rates, conversions, and breakdowns are unbiased and can
 * be read straight off the dashboard. Absolute counts are not — multiply by
 * 1 / SAMPLE_RATE (currently 2x) to estimate real volume.
 *
 * Lower this if the event bill starts to bite; raise it toward 1 if the traffic
 * turns out to be small enough that the samples are too noisy to trust.
 */
const SAMPLE_RATE = 0.5;

/**
 * Every event the app sends. Keeping them in a union rather than passing loose
 * strings means a typo fails `npm run check` instead of quietly creating a
 * second, near-identically-named event in PostHog that splits a funnel in two.
 */
export type AnalyticsEvent =
	| "lineup_drawn"
	| "tournament_started"
	| "bout_decided"
	| "coin_flipped"
	| "champion_crowned"
	| "champion_shared"
	| "bracket_undone"
	| "bracket_resumed"
	| "bracket_scrapped"
	| "custom_card_saved"
	| "shared_bracket_opened";

let started = false;
let client: PostHog | null = null;
/** Events fired in the gap between startAnalytics() and the SDK finishing loading. */
let pending: { event: AnalyticsEvent; properties?: Record<string, unknown> }[] = [];

/**
 * Boots PostHog. Safe to call more than once; only the first call does anything.
 *
 * The SDK is pulled in dynamically rather than imported at the top of the file:
 * it's about as much JavaScript as the entire rest of the app, and none of it
 * is needed to draw a bracket. This way it lands in its own chunk, fetched
 * after the page is interactive instead of before it renders.
 */
export function startAnalytics(): void {
	if (!browser || started || !PUBLIC_POSTHOG_KEY) return;
	started = true;
	void load();
}

async function load(): Promise<void> {
	const [{ default: posthog }, { sampleByDistinctId }] = await Promise.all([
		import("posthog-js"),
		import("posthog-js/dist/customizations"),
	]);

	posthog.init(PUBLIC_POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		// Opts into PostHog's current defaults rather than its 2020-era ones.
		// Notably it injects loaded scripts into <head>, which avoids hydration
		// mismatches in SSR/prerendered frameworks like this one.
		defaults: "2026-06-25",

		// Sampling. `before_send` runs on every event and drops the ones that
		// fall outside the sample before they leave the browser, so skipped
		// visitors cost neither bandwidth nor quota.
		before_send: sampleByDistinctId(SAMPLE_RATE),

		// Volume control. Autocapture would record every click, input, and
		// scroll — by far the biggest driver of event count, and the resulting
		// reports are keyed off CSS selectors that break whenever the markup
		// moves. The explicit events below cover the funnel instead. Session
		// replay is off for the same reason (and because a date-night bracket
		// is not worth recording someone's screen over).
		autocapture: false,
		capture_dead_clicks: false,
		capture_heatmaps: false,
		disable_session_recording: true,

		// Pageviews. SvelteKit routes on the client, so navigations are history
		// pushes rather than document loads; 'history_change' catches both.
		capture_pageview: "history_change",
		capture_pageleave: true,

		// Nobody logs in, so there are no person profiles to build. This keeps
		// visitors anonymous and off the billed-persons count.
		person_profiles: "identified_only",
	});

	client = posthog;
	for (const { event, properties } of pending) posthog.capture(event, properties);
	pending = [];
}

/**
 * Records one event. A no-op when analytics never started, so call sites don't
 * need to care whether a key is configured. Anything fired while the SDK is
 * still loading is held and sent once it arrives, so a fast first click off the
 * home screen isn't lost.
 */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
	if (!started) return;
	if (!client) {
		pending.push({ event, properties });
		return;
	}
	client.capture(event, properties);
}
