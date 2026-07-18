# Deep crawl (subscription-driven)

## Purpose

Crawl fixtures + tables for **subscribed leagues only** (ADR 0012's expensive, subscription-driven
layer), persisting them via the existing entity-resolution services. Never crawl every league.

## Requirements

- A `subscription` table modelling "a client subscribes to one of our leagues":
  - `id` — `sub_` prefixed nanoid
  - `clientName` — plain text for now (e.g. "Williamstown SC"); a real client entity is future work
  - `leagueId` — FK → `league.id` (our internal `lea_`). The league already carries
    `competitionId` + `seasonId` (0011), so the subscription is season-scoped transitively — no
    year/competition stored on the subscription.
- `tracked_competition` is **subsumed by subscriptions** (ADR 0012) — remove it (schema, entity,
  relations, queries). It has no readers today.
- Deep-crawl scope = **subscribed leagues** (distinct `leagueId` across subscriptions) **∪** any
  `--league <lea_id>` passed on the CLI (for testing/one-offs). Never all leagues.
- For each in-scope `lea_` id, resolve its Dribl `{season, competition, league, tenant}` hashes:
  - league hash ← `external_ref(dribl, leagueId)`
  - competition hash ← `external_ref(dribl, league.competitionId)`
  - season hash ← `external_ref(dribl, league.seasonId)`
  - tenant hash ← `resolveTenantId(...)` once per run (config-driven, like the catalog job)
    No name matching needed — a simplification over `resolveLeagueIds`.
- Then drive the existing `crawlFixturesByRound` + `crawlTable` (R2 staging) and persist via
  `resolveFixtureEntities` / `resolveTableEntryEntities`.
- `mday deep-crawl` CLI command (`--league` repeatable, `--dry-run`).

## Todo (sliced)

1. **Subscription model** — `subscription` table + migration; remove `tracked_competition`;
   `sub_` id prefix; Zod entity; queries: `upsertSubscription`, `listSubscribedLeagueIds`,
   `getLeagueById` (needed to walk league → competition/season for hash resolution). No crawl yet.
2. **Deep-crawl pipeline** — `resolveDriblLeagueIds(leagueId)` service (external_ref walk → the four
   hashes); `deepCrawlLeague` (fixtures + table + persist for one league); `deepCrawl` job
   (scope selection + per-league loop + crawl-run id); `mday deep-crawl` CLI. `--dry-run` stages
   raw + logs but skips DB upserts.

## Open questions

- `crawlFixturesByRound` / `crawlTable` currently take `trackedCompetitionId` (used only in the R2
  raw-key path). Rename to `leagueId` (the real grain now) as part of slice 2 — the raw key becomes
  `deep/<leagueId>/<crawlRunId>/...`.
- Client is plain `clientName` text for now; a `client` entity + Sanity team ref is deferred until
  the Sanity integration shape is known.
