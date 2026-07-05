import type { ReactNode } from "react";

/** A bulb-lit theater marquee frame. */
export function Marquee({ children, big = false }: { children: ReactNode; big?: boolean }) {
	return <div className={big ? "marquee marquee--big" : "marquee"}>{children}</div>;
}
