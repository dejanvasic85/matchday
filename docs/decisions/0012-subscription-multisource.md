# 0012. League subscriptions & multi-source ingest

- Status: decided
- Date: 2026-07-18
- Supersedes: 0002 (scraping scope); reshapes 0004 (depth), 0011 (data model)
- Reshaped by: [#141](https://github.com/dejanvasic85/matchday/issues/141) — we now keep a
  `league_team` table after all. Deriving membership from `table_entry`, as this ADR proposes
  below, silently misses divisions that publish fixtures but no ladder, such as MiniRoos age
  groups. `league_team` records every discovered team regardless. The rest of this ADR stands.
- Reshaped by: [#202](https://github.com/dejanvasic85/matchday/issues/202) — a subscription alone
  can't survive a season boundary. Because a `league` is scoped to one season, every subscription
  dies with that season, and this ADR records no provenance to re-derive the next one from. We
  therefore added `client_club`: a client **follows a club**, and subscriptions become derived
  state that `mday client sync-subscriptions` reconciles per season. Two consequences for the text
  below. The webhook moved from `client_subscription` onto `client_club`, so it outlives any one
  season rather than being reconfigured every year. And "current season" is **derived, not
  flagged** — season names are the source's own years, so the current season is the latest row,
  overridable with `--season`. The subscription remains the crawl-scope primitive and still keys on
  our internal `lea_` id, so the rest of this ADR stands.
- Input: the Dribl identity investigation of 2026-07-15. That plan document is no longer in the
  repo; its findings are summarised in the Context below.

## Context

0011 modelled a Dribl-only crawl keyed on competition, whose registry we seed from tenant teams
(0002). It made `team.clubId` a mandatory foreign key, and resolved every entity through a Dribl
id. Investigation and product thinking then changed the strategy, for three reasons.

1. **Our consumer, williamstownsc, is league-focused.** Content authors manage _teams_ in Sanity —
   name, photo, players and coaches, all editorial content — and each team binds to an external
   results feed. Today that binding is **free text somebody types by hand**, such as "Junior Girls
   Sunday (U12 - U18)" or "Girls' West 12B". That invites human error. Onboarding should instead
   let the author **select** a competition, then a league, from dropdowns backed by real scraped
   data.

2. **There is more than one source.** Dribl is our first source, not our only one. Williamstown
   Masters, for instance, play in a different federation with its own site. So `source` must be
   first-class in every external binding and identity, rather than a Dribl-specific detail.

3. **The crawl path exposes no stable club id, and Dribl models admin entities as "clubs".** A
   live API investigation found three things. The `ladders` and
   `fixtures` endpoints carry no club id and no link from team to club. The only durable ids on
   the crawl path are `team_hash_id` for teams, and `club_code` for clubs, which appears only on
   tables; we measured `club_code` as one-to-one with name and logo across 654 rows and 218 clubs.
   A club's logo can change, so it is not identity. Dribl also lists administrative
   pseudo-"clubs" — nine regional referee bodies and "FV Registrations" — that share a placeholder
   logo and **never appear on any table**. We must therefore **discover clubs from real
   competition data**, and never enumerate them as the primary ingest unit.

## Recommendation

### The binding: a Sanity team subscribes to a league

Each Sanity team declares a **subscription**: a hard, reliable link to an external results feed.
The subscription stores **our internal `lea_` id** as a foreign key, never a Dribl name or hash.

```
(client, leagueId → league) → linked Sanity team
```

The admin picks a league from **catalog dropdowns**, which we populate from our own `league` rows.
The subscription is therefore a referential link, never text somebody typed. The catalog crawl
below creates those `league` rows first, so there is always something to select and to key
against.

A `league` already ties a competition to a **season**, through `league.seasonId` in 0011. So the
league the subscription points at scopes it to a season automatically, and the subscription needs
no separate `year` field.

**The subscription targets the league, not the team.** Results and table data flow from the
subscribed league. Whether the site _highlights_ a particular team depends on that team actually
appearing in the league, which is a separate concern — see Regrades below.

### Two catalog/crawl layers, cleanly separated

- **Catalog — cheap, source-wide.** One job lists _every_ competition, league and team for a
  source and year. For Dribl that means the `list/*` endpoints, plus a light pass over each
  league's latest round and table to list its teams. It fills the onboarding dropdowns, so an
  admin can select any league with certainty. It runs on a schedule whether or not anyone
  subscribes.
- **Deep crawl — driven by subscriptions.** A separate job crawls fixtures and tables **only** for
  leagues with at least one subscription. This is the expensive per-round and per-table work.

Both crawls **discover** clubs and teams as they go, from `club_code` and `team_hash_id` on the
table, rather than enumerating them as the primary unit. Admin pseudo-clubs never appear on a real
league's table, so we **never create them**. That filtering is structural, not a hack that matches
on name patterns.

A separate **club-enrichment** job fetches richer club detail — grounds, colours, address and
socials — and **writes to the same club rows** the crawl discovered. Two jobs, one aggregated
dataset.

### Catalog entities are first-class relations

We store competition, league and team as **real entity rows with our own internal ids** —
`cmp_`, `lea_` and `tea_`, per 0011 — with proper foreign keys such as `league.competitionId` and
`league.seasonId`, and an `external_ref` back to each source id. The catalog crawl _populates_
them source-wide, ahead of any subscription. They become **REST resources** in Phase 4, so
Sanity's onboarding screen can drive cascading dropdowns from competitions to leagues to teams,
and store the internal `lea_` id the admin selected.

**We derive which teams are in a league; we do not maintain it.** A team belongs to a league
because it has `fixture` or `table_entry` rows there, and both already carry `leagueId` per 0011.
So "which teams are in this league" is a query, not a stored edge. When a team is regraded, it
simply starts accruing rows under the new league, which begins from zero points like any fresh
league. The old league's rows stay as historical results and affect no current table.

**We therefore need no temporal `team_league` join table and no membership-history model.** The
fixtures and table entries _are_ the history, and we neither show it on the site nor expose it
through the API.

### Identity keys (from the investigation)

Resolve each entity by the most stable id its path exposes, through
`external_ref (source, source_id)`:

| Entity      | Source id                | Notes                                                                                                |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| competition | Dribl competition hash   | From `list/competitions`. Upserted by the catalog crawl.                                             |
| league      | Dribl league hash        | Per (competition, season). Stable key → re-crawl reuses the `lea_` row, so subscriptions stay valid. |
| team        | `team_hash_id`           | On every table/fixture row. Stable; never dupes.                                                     |
| club        | `club_code` (per source) | Table-only, always present, unique, rebrand-safe.                                                    |

The subscription references our internal `lea_` id, and the catalog upserts leagues by
`external_ref(dribl, <league hash>)`. So a re-crawl maps the same Dribl league back to the same
`lea_` row, and every subscription stays valid automatically — without storing any Dribl
identifier in the subscription itself.

Treat a logo as **a hint for joining during enrichment, never as identity.** Logos change, and
admin pseudo-clubs share one, so matching on a logo collapses distinct clubs into one. And
`team.clubId` is now **nullable**, where 0011 made it mandatory: we store a team we cannot yet
resolve to a club, and link it later.

### Regrades are tolerated by design

Say a team is regraded into a new league, and the admin does not update the subscription:

- The subscription still points at the old league, so **results and table data keep flowing**.
- Nobody finds the team _in_ that league, so the site has **no team to highlight**. We accept
  that.
- A future **notification** could spot the mismatch between subscription and presence, and prompt
  the admin. That is **out of scope for the initial deploy**.

This decoupling is the point. The subscription drives the data, the team's presence drives the
highlighting, and the two fail independently and gracefully.

### Multi-source from the start

- Every external binding and identity carries a **`source`**. `external_ref (source, source_id)`
  from 0005 already generalises to that. The crawler must stay **abstracted over its source**, so
  adding one means writing a new adapter and catalog, not a rewrite.
- Dribl is the only source we implement for the initial deploy. Other federations, such as
  Masters, get a source adapter later. We note them; we do not build them now.

## Consequences

- **New entity.** A **subscription** `(client, leagueId → league, sanityTeamRef)`, keyed on our
  internal `lea_` id rather than a Dribl identifier. Competition, league and team already exist as
  first-class entities from 0011; the catalog crawl populates them source-wide and gives each an
  `external_ref`. The subscription concept subsumes `tracked_competition` from 0011.
- **No new membership table.** We derive team-to-league from `fixture` and `table_entry`, which
  both carry `leagueId`. No temporal join, no history model. (#141 later revisited this — see the
  header.)
- **Subscriptions drive the schedule.** The 0003 cadence still applies. What changes is _which_
  leagues we crawl: subscriptions decide, not a registry somebody seeded by hand.
- **`team.clubId` becomes nullable** in the 0011 schema, which needs a migration. And
  `external_ref.source` becomes a real multi-value union — `dribl`, `dribl_club_code`, and future
  sources — in the `packages/domain` and `packages/db` constants.
- **Clubs are demoted.** The crawl discovers them, and `clubs-sync` enriches the rows it found
  rather than acting as a standalone authority.
- **williamstownsc must change its Sanity schema.** The team's hand-typed "Fixtures Crawler"
  competition and league fields become a **catalog-backed subscription** that references a
  matchday league id and source.
- **Prior work.** This supersedes the Dribl-only "clubs-sync as authority" spike, which sits on an
  unmerged branch. Its reusable ideas inform the rebuild: the `mday` CLI shell, R2 staging, the
  crawl building blocks, the `Result` and dependency-injection architecture, and multi-source
  `external_ref`. The standalone clubs-sync-as-authority job does not carry forward. We re-listed
  the schema follow-ups it found as todo items, and none are in the tree yet: fixing the top-level
  `name` in `driblListResponseSchema`, parsing socials tolerantly, making `team.clubId` nullable,
  and widening the `source` union.

## Resolved during review

- **The subscription key is our internal `lea_` id.** The subscription stores a foreign key to our
  `league` row, not a Dribl identifier. The catalog upserts leagues by
  `external_ref(dribl, <league hash>)`, the stable source id for each competition and season pair.
  A re-crawl therefore maps the same Dribl league back to the same `lea_` row, and subscriptions
  stay valid automatically. We decided this by reasoning rather than measurement; if the league
  hash ever drifts, `external_ref` is where we recover. The subscription needs no separate `year`,
  because the league's `seasonId` already scopes it.
- **We derive team-to-league membership** from `fixture` and `table_entry`, rather than
  maintaining it. Regrades then work naturally: the new league starts from zero, and the old
  results stay attached to the old league where nobody sees them. No history model.

## Open questions

- **What does listing teams in the catalog cost?** We plan to read each league's latest round and
  table to list its teams. Measure that across a whole tenant before committing to a cadence.
- **What must a source adapter implement?** We will design the exact interface — catalog, deep
  crawl and identity mapping — when we have a real second source.
