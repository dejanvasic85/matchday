# Deep crawl (subscription-driven)

## Purpose

Crawl fixtures + a table for **one league per invocation** (ADR 0012's expensive layer), persisting
via the existing entity-resolution services. Never crawl every league in one process.

**Revised during slice 2 planning:** the original design below had one job loop over every
subscribed league inside a single shared browser session (`--league` as a manual add-on). We
changed this to **one invocation = one league** — leagues will eventually run on independent,
fixture-derived cadences (0003: match-window timing differs per league), and a stuck/slow league
shouldn't block others. Deciding _what_ invokes this crawl per subscribed league (a cron matrix, a
queue, a scheduler loop) is deferred to the still-open Scheduling backlog item — this doc covers
only the single-league crawl unit itself.

## Requirements

- A `subscription` table modelling "a client subscribes to one of our leagues":
  - `id` — `sub_` prefixed nanoid
  - `clientName` — plain text for now (e.g. "Williamstown SC"); a real client entity is future work
  - `leagueId` — FK → `league.id` (our internal `lea_`). The league already carries
    `competitionId` + `seasonId` (0011), so the subscription is season-scoped transitively — no
    year/competition stored on the subscription.
- `tracked_competition` is **subsumed by subscriptions** (ADR 0012) — remove it (schema, entity,
  relations, queries). It has no readers today.
- `mday deep-crawl --league <lea_id>` crawls **exactly that one league** — required, singular, not
  unioned with subscriptions. `listSubscribedLeagueIds` (built in slice 1) stays unused until the
  Scheduling slice decides how to invoke this per subscribed league.
- Resolve the invoked league's Dribl `{season, competition, league, tenant}` hashes:
  - league hash ← `external_ref(dribl, leagueId)`
  - competition hash ← `external_ref(dribl, league.competitionId)`
  - season hash ← `external_ref(dribl, league.seasonId)`
  - tenant hash ← `resolveTenantId(...)` once per run (config-driven, like the catalog job)
    No name matching needed — a simplification over `resolveLeagueIds`.
- Then drive the existing `crawlFixturesByRound` + `crawlTable` (R2 staging) and persist via
  `resolveFixtureEntities` / `resolveTableEntryEntities`.
- `mday deep-crawl` CLI command (`--league` required, `--dry-run`).

## Todo (sliced)

1. **Subscription model** — `subscription` table + migration; remove `tracked_competition`;
   `sub_` id prefix; Zod entity; queries: `upsertSubscription`, `listSubscribedLeagueIds`,
   `getLeagueById` (needed to walk league → competition/season for hash resolution). No crawl yet.
2. **Deep-crawl pipeline** — `resolveDriblLeagueIds(leagueId)` service (external_ref walk → the
   three hashes, reverse-lookup via the new `findExternalRefByInternalId` query); `deepCrawlLeague`
   (fixtures + table + persist for one league); `deepCrawlJob`/`runDeepCrawlJob` (single-league
   transport glue, no loop); `mday deep-crawl --league <lea_id> [--dry-run]`. `--dry-run` stages
   raw + logs but skips DB upserts. Also fixed two pre-existing ADR 0012 gaps blocking this slice:
   `resolveClub` now resolves by `external_ref(dribl_club_code, clubCode)` (previously logo/name
   only), and `resolveEntityByExternalRef` now accepts an optional `source` so `resolveClub` can use
   it for club identity.

## Resolved

- `crawlFixturesByRound` / `crawlTable` took `trackedCompetitionId` (used only in the R2 raw-key
  path) — renamed to `leagueId` in slice 2; the raw key is now `deep/<leagueId>/<crawlRunId>/...`.

## Open questions

- Client is plain `clientName` text for now; a `client` entity + Sanity team ref is deferred until
  the Sanity integration shape is known.
- How/when `mday deep-crawl --league <id>` gets invoked per subscribed league (cron matrix, queue,
  scheduler loop) — deferred to the Scheduling backlog item.
