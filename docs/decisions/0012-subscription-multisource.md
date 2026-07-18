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
   / "Girls' West 12B") — a human-error surface. The ideal onboarding: the author **selects** a
   league (competition → league) from dropdowns backed by real scraped data, with certainty.

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

Each Sanity team declares a **subscription** — a hard, reliable link to an external results feed.
The subscription stores **our internal `lea_` id** (a foreign key), not Dribl names or hashes:

```
(client, leagueId → league) → linked Sanity team
```

The admin selects a league from **catalog dropdowns** (populated from our `league` rows), so the
subscription is a referential link, never hand-typed text. The catalog crawl (below) creates the
`league` rows first, so there is always something to select and to key against.

Because a `league` already ties a competition to a **season** (0011: `league.seasonId`), the
subscription is **inherently season-scoped through the league it points at** — no separate `year`
field is needed on the subscription.

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

### Catalog entities are first-class relations

Competition, league, and team are persisted as **real entity rows with our own internal ids**
(`cmp_`/`lea_`/`tea_`, per 0011) and proper foreign keys (`league.competitionId`,
`league.seasonId`), each with an `external_ref` back to its source id. The catalog crawl is what
_populates_ them source-wide, ahead of any subscription. These become **REST resources** (Phase 4)
so Sanity's onboarding UI drives cascading dropdowns (competitions → leagues → teams) and stores
the selected internal `lea_` id.

**Team↔league membership is derived, not a maintained relationship.** A team belongs to a league
by virtue of having `fixture` / `table_entry` rows for it (both already carry `leagueId`, per 0011)
— so "which teams are in this league" is a query, not a stored edge. On a regrade the team simply
accrues rows under the new league (which starts from 0 points, like a fresh league); the old
league's rows remain as historical results with no effect on any current table. **No temporal
`team_league` join table and no membership-history model are needed** — the fixtures/table entries
_are_ the history, and we neither surface it on the site nor expose it via the API.

### Identity keys (from the investigation)

Resolve entities by the stablest id each path exposes, via `external_ref (source, source_id)`:

| Entity      | Source id                | Notes                                                                                                |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| competition | Dribl competition hash   | From `list/competitions`. Upserted by the catalog crawl.                                             |
| league      | Dribl league hash        | Per (competition, season). Stable key → re-crawl reuses the `lea_` row, so subscriptions stay valid. |
| team        | `team_hash_id`           | On every ladder/fixture row. Stable; never dupes.                                                    |
| club        | `club_code` (per source) | Ladder-only, always present, unique, rebrand-safe.                                                   |

The subscription references our internal `lea_` id, and the catalog upserts leagues by
`external_ref(dribl, <league hash>)` — so a re-crawl maps the same Dribl league back to the same
`lea_` row and every subscription remains valid automatically, without storing any Dribl identifier
in the subscription itself.

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

- **New entities/tables:** a **subscription** `(client, leagueId → league, sanityTeamRef)` — keyed
  on our internal `lea_` id, not Dribl identifiers. Competition/league/team already exist as
  first-class 0011 entities; the catalog crawl populates them source-wide and each gains an
  `external_ref`. `tracked_competition` (0011) is subsumed by the subscription concept.
- **No new membership tables:** team↔league is derived from `fixture`/`table_entry` (both already
  carry `leagueId`); no temporal join or history model.
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

## Resolved during review

- **Subscription key = our internal `lea_` id.** The subscription stores a FK to our `league` row,
  not any Dribl identifier. The catalog upserts leagues by `external_ref(dribl, <league hash>)`
  (the stable per-(competition, season) source id), so a re-crawl maps the same Dribl league back to
  the same `lea_` row and subscriptions stay valid automatically. Decided by reasoning; if the
  league hash ever drifts, `external_ref` is the recovery seam. No separate `year` on the
  subscription — the league's `seasonId` already scopes it.
- **Team↔league membership is derived** from `fixture`/`table_entry`, not a maintained/temporal
  relationship. Regrades work naturally (new league starts from 0; old results stay attached to the
  old league, unsurfaced). No history model.

## Open questions

- **Catalog team-enumeration cost.** "Latest round/table per league to list teams" across a whole
  tenant — measure before committing to its cadence.
- **Source-adapter interface.** The exact abstraction a new source must implement (catalog +
  deep-crawl + identity mapping) — designed when the second source is real.
