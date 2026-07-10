import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App";
import { MOVIE_LISTS } from "./data/movies";

vi.stubGlobal("localStorage", {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {},
});

describe("App", () => {
	it("renders the home screen with every generated lineup", () => {
		const html = renderToString(<App />)
			.replaceAll("&amp;", "&")
			.replaceAll("&#x27;", "'");
		expect(html).toContain("What to Watch");
		for (const list of MOVIE_LISTS) {
			expect(html).toContain(list.name);
		}
	});
});
