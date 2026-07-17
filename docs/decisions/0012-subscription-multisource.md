# 0012. League subscriptions & multi-source ingest

- Status: decided
- Date: 2026-07-18
- Supersedes: 0002 (scraping scope); reshapes 0004 (depth), 0011 (data model)
- Input: `docs/plans/2026-07-15-dribl-identity-investigation.md`

## Context

0011 modelled a Dribl-only, competition-keyed crawl whose registry is "seeded from tenant teams"
(0002), with `team.clubId` a mandatory FK and every entity resolved via a Dribl id. Investigation
and product thinking changed the strategy:

1. **The consumer (williamstownsc) is league-focused.** Content authors administer _teams_ in
   Sanity (name, photo, players, coaches — editorial content), and each team binds to an external
   results feed. Today that binding is **hand-typed** free text ("Junior Girls Sunday (U12 - U18)"
   / "Girls' West 12B") — a human-error surface. The ideal onboarding: the author **selects**
   competition/league/year from dropdowns backed by real scraped data, with certainty.

2. **Sources are plural.** Dribl is the first source, not the only one — e.g. Williamstown Masters
   play in a different federation with its own site. `source` must be first-class in every external
   binding and identity, not a Dribl-specific detail.

3. **The crawl path exposes no stable club id, and Dribl models admin entities as "clubs".** A live
   API investigation (see the input doc) found: `ladders`/`fixtures` carry no club id and no
   team→club link; the only durable crawl-path ids are `team_hash_id` (teams) and `club_code`
   (clubs, ladder-only, measured 1:1 with name/logo across 654 rows / 218 clubs); logo is mutable.
   Dribl also lists administrative pseudo-"clubs" (9 regional referee bodies, "FV Registrations")
   that share a placeholder logo and **never appear on any ladder**. So clubs must be **discovered
   from real competition data**, never enumerated as the primary ingest unit.

## Recommendation

### The binding: a Sanity team subscribes to a league

Each Sanity team declares a **subscription** — a hard, reliable link to an external results feed:

```
(source, year, competition, league) → linked Sanity team
```

e.g. `(dribl, 2026, "Junior Girls Sunday (U12 - U18)", "Girls' West 12B")` → _Williamstown U12C
Girls_. Chosen from **catalog dropdowns**, never typed.

**The subscription targets the league, not the team.** Results and table data flow from the
subscribed league. Whether a specific team is _highlighted_ on the website depends on that team
actually appearing in the league — a separate concern (see Regrades).

### Two catalog/crawl layers, cleanly separated

- **Catalog (cheap, source-wide).** A job enumerates _all_ competitions, leagues, and teams for a
  source + year — for Dribl, the `list/*` endpoints plus a light pass at the latest round/table of
  each league to enumerate teams. Populates onboarding dropdowns so any league can be selected with
  certainty. Runs on a schedule regardless of subscriptions.
- **Deep crawl (subscription-driven).** A separate job crawls fixtures + tables **only** for
  leagues with ≥1 subscription — the expensive per-round/ladder work.

Clubs and teams are **discovered** during these crawls (from ladder `club_code` / `team_hash_id`),
never enumerated as the primary unit. Because admin pseudo-clubs never appear on a real league's
ladder, they are **never created** — the filtering is structural, not a name-pattern hack. A
separate **club-enrichment** job fetches richer club detail (grounds, colours, address, socials)
and **writes to the same club rows** the crawl discovered: two jobs, one aggregated dataset.

### Identity keys (from the investigation)

Resolve entities by the stablest id each path exposes, via `external_ref (source, source_id)`:

| Entity | Source id                | Notes                                              |
| ------ | ------------------------ | -------------------------------------------------- |
| team   | `team_hash_id`           | On every ladder/fixture row. Stable; never dupes.  |
| club   | `club_code` (per source) | Ladder-only, always present, unique, rebrand-safe. |

Logo is an **enrichment-join hint, not identity** (mutable; and shared by admin pseudo-clubs — so
matching on it over-collapses distinct entities). `team.clubId` is **nullable** (0011 had it
mandatory): a team seen without a resolvable club is stored unlinked and linked later.

### Regrades are tolerated by design

If a team is regraded to a new league and the admin doesn't update the subscription:

- The subscription still points at the old league → **results and table data keep flowing**.
- The team won't be found _in_ that league → **no team to highlight** on the site. Accepted.
- A future **nudge/notification** can detect the subscription↔presence mismatch and prompt the
  admin. **Out of scope for initial deploy.**

This decoupling is the point: subscription drives data; team presence drives highlighting; they
fail independently and gracefully.

### Multi-source from the start

- Every external binding and identity carries **`source`**. `external_ref (source, source_id)`
  (0005) already generalises to this; the crawler must be **source-abstracted** so a new source is
  a new adapter + catalog, not a rewrite.
- Dribl is the only implemented source for initial deploy. Other federations (e.g. Masters) are a
  later source-adapter — noted, not built now.

## Consequences

- **New entities/tables:** a **subscription** `(source, year, competition, league, sanityTeamRef)`
  and a source-scoped **catalog** of competitions/leagues/teams. `tracked_competition` (0011) is
  subsumed by the subscription concept.
- **Scheduling is subscription-driven** (0003 cadence still applies; the _set_ of what's crawled
  comes from subscriptions, not a hand-seeded registry).
- **`team.clubId` becomes nullable** in the 0011 schema (migration); `external_ref.source` becomes
  a real multi-value union (`dribl`, `dribl_club_code`, future sources) in `packages/domain` +
  `packages/db` constants.
- **Clubs demoted:** discovered by the crawl; `clubs-sync` is enrichment over discovered rows, not
  a standalone authority.
- **Sanity change (williamstownsc repo):** the team's hand-typed "Fixtures Crawler" competition/
  league fields become a **catalog-backed subscription** referencing a matchday league id + source.
- **Prior work:** the Dribl-only "clubs-sync as authority" spike (an unmerged branch) is superseded.
  Its reusable concepts — the `mday` CLI shell, R2 staging, crawl building blocks, `Result`/DI
  architecture, multi-source `external_ref` — inform the rebuild; the standalone
  clubs-sync-as-authority job does not carry forward. The schema follow-ups it identified
  (`driblListResponseSchema` top-level-`name` fix, tolerant socials parse, nullable `team.clubId`,
  multi-value `source` union) are re-listed as todo items, not yet in the tree.

## Open questions

- **Stable league key.** Is a Dribl league identified stably across seasons, or is
  `(source, year, competition, league)` by _name_ the durable subscription key? Needs a crawl to
  confirm before the subscription schema is finalised.
- **Catalog team-enumeration cost.** "Latest round/table per league to list teams" across a whole
  tenant — measure before committing to its cadence.
- **Source-adapter interface.** The exact abstraction a new source must implement (catalog +
  deep-crawl + identity mapping) — designed when the second source is real.
