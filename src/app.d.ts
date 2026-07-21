// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				/** Cloudflare static-assets binding (wrangler.jsonc) — the built site's own files. */
				ASSETS: { fetch: typeof fetch };
			};
		}
	}
}

export {};
