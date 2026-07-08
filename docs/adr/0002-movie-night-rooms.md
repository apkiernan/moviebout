# ADR 0002: Movie-night rooms on a free-tier room server; bracket play stays client-side

- **Status:** Accepted
- **Date:** 2026-07-07
- **Amends:** [ADR 0001](0001-tmdb-build-time-data.md) — the "no backend" principle

## Context

Groups run a movie night where each person brings a set of picks and the group chooses
what to watch. The app's bracket is a natural fit, but it needs a way for several people
to pool their picks into one field: a shared "room" that friends join from their own
phones, with no accounts.

Constraints that shape the design:

- **The format does not change.** It is still the head-to-head elimination bracket — one
  winner, watched tonight. Rooms exist only to assemble the field; they are not a
  fantasy-style turn-based draft.
- **ADR 0001's principle** — no backend, no accounts, no API keys at runtime — collides
  with rooms, which inherently require shared mutable state. Something networked has to
  exist somewhere.
- **Cost must be structurally zero.** Not "cheap at this scale" — the backend must run
  indefinitely on a free tier with hard caps, where the failure mode under a bug or
  abuse is _errors_, never a bill.
- **Party conditions.** Everyone is on the same wifi (public IPs collide, so IP cannot
  identify players), phones lock between bouts (connections drop and must resume
  cheaply), and guests are non-technical (joining must be a QR scan and a name).
- **The bracket is hardcoded to 16 movies / 4 rounds** (`src/bracket.ts`), and
  N players × M picks rarely equals 16.

## Decision

Three parts, deliberately separable:

1. **Rooms collect picks; the bracket still plays locally.** Room lifecycle is
   `lobby → collecting picks → field locked`. A host creates a room and gets a short
   code + QR link; players join with a display name, identified by a random device UUID
   in `localStorage` (no accounts). Everyone submits picks (same free-text parsing as
   the custom card builder). When the host locks the field, the server's job is done:
   the seeded field lands on the host device and the bracket runs exactly as today —
   one shared screen (phone passed around or cast to the TV), `localStorage` save,
   undo, all of it. Picks are badged with their owner's name.

2. **The bracket becomes elastic** (frontend-only, ships independently). Any field size
   n works: the excess over the largest power of two ≤ n plays a play-in round for the
   remaining spots, everyone else gets a bye, and the total is always n − 1 bouts.
   Seeding is owner-aware — each player's picks are spread across bracket regions (and
   byes spread across owners) so nobody's slate self-eliminates in round one. Duplicate
   picks across players merge into one entry credited to everyone who picked it. Room
   settings surface the consequence of the picks-per-person knob ("5 people × 5 picks =
   24 bouts"). This also fixes solo custom cards, which today silently slice a pasted
   list down to 16.

3. **The backend is a Cloudflare Worker with one Durable Object per room, on the free
   plan.** A Durable Object gives single-threaded authority over room state, WebSockets
   with hibernation (idle rooms consume nothing), and alarms to expire rooms after
   ~24 hours — rooms are ephemeral by design. The free plan hard-caps daily usage
   (~100k requests/day, comfortably dozens of simultaneous movie nights) and **fails
   closed**: past the cap, requests error; with no card on file there is no path to a
   charge. The pure functions in `src/bracket.ts` (seeding, advancement, champion) run
   unchanged inside the Durable Object. The static app can be served from the same
   platform, keeping one deploy story.

## Alternatives considered

- **Zero-infrastructure merge (URL/QR pick sharing).** Each guest builds picks on their
  own phone and sends the host a link encoding them; the host device merges and runs
  the bracket. No server at all, and it remains the fallback if the Worker ever goes
  away. Rejected as the primary design: multi-step message-passing is clunky for
  non-technical guests, and there is no live lobby ("who's in? who's still picking?").
- **P2P WebRTC (e.g. Trystero) — no backend, literally.** Signaling over public
  BitTorrent/Nostr infrastructure keeps ADR 0001 intact, and same-LAN WebRTC is
  reliable. Rejected: mobile Safari suspends JavaScript when a phone locks, so the
  host peer dying mid-night stalls the room; recovering requires host migration and
  replicated state, which costs more complexity than the Durable Object it avoids.
- **Managed realtime (Firebase, Supabase, Ably, Liveblocks).** Less code to own, but
  the API key ships in the bundle, authorization rules must be authored anyway, and
  server-authoritative room logic ends up wanting server code regardless — at which
  point the Durable Object is less total surface and one fewer vendor.
- **Always-on container (Railway, Render).** Railway no longer has a true free tier
  (one-time trial credit, then ~$5/month Hobby minimum); Render's free tier spins down
  and cold-starts. A 24/7 container is the wrong shape for a few hours of Saturday
  traffic, and the cost is small but not zero.
- **AWS Lambda + API Gateway WebSockets + DynamoDB.** Lambda's free tier is permanent,
  but WebSockets require API Gateway (free for 12 months only, then per-message and
  per-connection-minute) plus DynamoDB for state — three services where Cloudflare
  needs one — and AWS has no hard spending cap: its failure mode is a bill, which is
  exactly what this decision must rule out.
- **Per-device voting in v1 (or "voting-ready": bracket state lives server-side, the
  shared screen is just a client).** Every bout pushed to every phone, majority
  advances, vote split revealed. The most fun version, but it roughly doubles the sync
  surface (live bout state, vote collection, reveal timing, stragglers, reconnects).
  Deferred to v2 with the migration cost accepted knowingly — see Consequences.
- **IP / user-agent identity.** Rejected: at a party everyone shares one public IP, and
  identical phone models produce identical user-agents. A `localStorage` device UUID
  plus a chosen display name is simpler and actually works.

## Consequences

- **ADR 0001 is amended, not repealed.** The solo app remains static, offline-capable,
  and keyless; rooms are the one networked feature, and if the Worker vanished the solo
  app would be unaffected. "No backend" becomes "no backend for the core experience,
  and no backend that can cost money."
- **New operational surface:** a Worker to deploy (wrangler) and a room state machine
  (~300–400 lines) to maintain. `src/bracket.ts` must stay pure and DOM-free so client
  and Durable Object share it.
- **Cost failure mode is the right one.** Abuse or a runaway bug exhausts the daily cap
  and rooms error out for the day; nothing bills, and the static app keeps working.
- **Vendor coupling to Cloudflare** (Durable Object APIs, hibernation, alarms). Accepted:
  the protocol is small enough to port if that ever matters.
- **Rooms are ephemeral.** They expire after ~24 hours; there is no history, no saved
  rooms, nothing to migrate or back up.
- **v2 per-device voting requires a state-ownership migration** — bracket state would
  move from the host device into the room, and the shared screen would become just
  another client. This cost was weighed against a smaller v1 and consciously accepted.
- **Bracket internals become computed** — `TOTAL_BOUTS`, `ROUND_NAMES`, and the saved-game
  validation stop assuming 16 movies / 4 rounds, which means a save-format version bump.
- The elastic bracket ships first and alone: it is frontend-only, has standalone value
  for solo custom cards, and de-risks the seeding/play-in logic before any server exists.
