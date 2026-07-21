# matchday — roadmap

Sequenced, dependency-ordered work. Decisions are locked in
[docs/decisions](decisions/README.md) (0001–0010, all decided). This file is the build
backlog: an agent/session should pick the **first unchecked item whose deps are met**, do it,
tick it, and commit.

Conventions: `[ ]` todo · `[~]` in progress · `[x]` done. Each item links the ADR(s) it
implements. Keep this file updated as work completes.

**Guiding principle:** hold a very high standard throughout — clean, maintainable code and a
project that stays easy to reason about. Prefer small, well-named functions over cleverness;
no dead code or speculative abstraction; strong types and tests. Every phase is judged on
maintainability, not just "it works".

---

## Phase 0 — Foundations (do first)

Project setup + standards. Mostly mirrors what williamstownsc already has; port and adapt.

- [x] **Monorepo scaffold** — pnpm workspaces + Vite+ (`vp`); `apps/{api,scraper}`,
      `packages/{domain,db}`. Root `pnpm-workspace.yaml`, `vite.config.ts`. (→ 0010)
- [x] **Node/runtime + Mise** — Node pinned to 24.18.0 via `.mise.toml`, matching WSC.
- [x] **TypeScript config** — per-package strict `tsconfig` (`nodenext`, `verbatimModuleSyntax`,
      `noUnusedLocals/Parameters`); root base config. (→ 0008)
- [x] **Lint/format** — Vite+ Oxlint + Oxfmt (replaces ESLint/Prettier); no-`as` casting enforced
      as lint errors; `vp staged` pre-commit hook via `vp config`.
- [x] **Testing setup** — Vitest via `vp test` (real vitest, `environment: node`, globals on,
      `clearMocks`). Unit tests co-located as `*.test.ts`. `Result` primitive covered as a first test.
- [x] **Engineering standards doc** — `AGENTS.md` + `.claude/CLAUDE.md` (imports `@../AGENTS.md`):
      stack, Vite+ workflow, `Result`/DI architecture, code style, unit-testing conventions.
- [x] **Agent skills / instructions** — `dribl-crawling` + `renovate-pr` skills under `.agents/skills`,
      symlinked into `.claude/skills`. (schema/migration skill deferred to Phase 1.)
- [x] **CI** — GitHub Actions (`voidzero-dev/setup-vp`): `vp check` + `vp run -r test` + `vp run -r build`
      on PR/push to main.
- [x] **Env/config** — Zod-validated config module per app (`getApiConfig`/`getScraperConfig` via a
      shared `parseEnv` in `packages/domain`) + `.env.example`. Secrets: Wrangler (api) / thanos (scraper).

## Phase 1 — Data model & schema (keystone)

- [x] **0011 data-model ADR** — `docs/decisions/0011-data-model.md`: entities (club, team,
      competition, season, fixture, table_entry, tracked_competition, external_ref), fields
      from 0004, relationships, ID prefixes from 0005. Unblocks everything below. (→ 0004,0005,0006)
- [x] **DB package + Drizzle** — `packages/db`: Drizzle schema modelling 0011, migrations,
      Neon connection (serverless driver / Hyperdrive). (→ 0006, 0009)
- [x] **Neon project setup** — create/confirm Neon project + branches (dev/prod); run first
      migration. (→ 0009)

## Phase 2 — Domain

- [x] **Domain package** — `packages/domain`: Zod schemas for entities, prefixed-nanoid ID
      service (`clb_`/`tea_`/`cmp_`/`sea_`/`lea_`/`mtc_`/`tab_`/`ext_`/`trk_`), branded ID types.
      (→ 0004, 0005, 0011)
- [x] **Transformers** — Dribl raw → domain (port WSC's transform/mapper logic). Raw external
      Zod schemas (`external/driblClub.ts`, `driblFixture.ts`, `driblTableEntry.ts`) +
      `mapDriblClub`/`mapDriblFixture`/`mapDriblTableEntry` mappers in `packages/domain`.
      Mappers stop short of resolving club/team/competition/season/league entity IDs (needs DB
      lookups); that resolution is a Phase 3 crawler-core/service concern.

## Phase 3 — Scraper

Strategy is set by **0012** (league-focused subscriptions, multi-source, catalog vs deep crawl).
Crawl building blocks (playwright-core session, browser fetch, `resolveLeagueIds`, `crawlTable`,
`crawlFixturesByRound`, R2 raw staging, the `mday` CLI shell) exist from an earlier spike and carry
forward; the strategy below rewires how they're driven.

- [x] **0012 schema follow-ups** (→ 0012)
  - [x] Relax `team.clubId` to nullable (migration).
  - [x] Make `external_ref.source` a real multi-value union (`dribl`, `dribl_club_code`, future
        sources) in `packages/domain` + `packages/db`.
  - [x] Fix `driblListResponseSchema` (list items are top-level `name`/`id`).
  - [x] Loosen `driblClubSocial.name` to a tolerant parse.
- [ ] **Subscription data model** — subscription entity `(client, leagueId → league, sanityTeamRef)`,
      keyed on our internal `lea_` id (not Dribl identifiers); subsumes `tracked_competition`.
      Competition/league/team are already first-class 0011 entities; no team↔league join/history
      table (membership is derived from `fixture`/`table_entry`). (→ 0011, 0012)
- [x] **Catalog crawl job** — cheap, source-wide: upsert all competitions/leagues/teams for a
      source + year as first-class rows with internal ids + `external_ref` (league keyed on the Dribl
      league hash). Dribl `list/*` + a light latest-round/table pass to list teams. Populates the
      REST-served onboarding dropdowns. Runs regardless of subscriptions. `mday catalog`
      (`--max-leagues`, `--dry-run`). (→ 0011, 0012)
- [x] **Deep crawl job (single-league unit)** — fixtures + table for **one league per invocation**;
      discovers clubs/teams (team by `team_hash_id`, club by `club_code`), sets `team.clubId` from
      the table row; raw staged to R2 then transformed/upserted by external_ref. One invocation = one
      league, so leagues can eventually run on independent, fixture-derived cadences (0003) and a
      slow/failing league can't block others — deciding *what* invokes this per subscribed league
      (cron matrix, queue, scheduler loop) is deferred to Scheduling below. (→ 0003, 0004, 0012)
  - [x] Subscription model: `subscription` table (client*name + `lea*`FK), replaces
        `tracked_competition`; `upsertSubscription`/`listSubscribedLeagueIds`/`getLeagueById`.
  - [x] Deep-crawl pipeline + `mday deep-crawl --league <lea_id> [--dry-run]` (single league,
        required; not unioned with subscriptions — see above).
- [ ] **Club enrichment job** — fetch rich club detail (grounds/colours/address/socials) from the
      `clubs/{id}` endpoint; attach by logo to clubs the deep crawl discovered; never create. Needs a
      club-enrichment data-model decision (venue entity vs club columns). (→ 0004, 0012)
- [ ] **Source-abstraction seam** — factor the crawler so a source is an adapter (catalog +
      deep-crawl + identity mapping). Dribl is the first adapter; designed for a second later. (→ 0012)
- [ ] **Scheduling** — wire per-job triggers (thanos cron / GH Actions / CF Cron), driven by the
      subscription set. (→ 0003, 0009, 0012)

## Phase 4 — API

- [ ] **Hono app on Workers** — `apps/api`; wrangler config; Neon access from the isolate.
      (→ 0007, 0009)
- [ ] **OpenAPI + routes** — `@hono/zod-openapi`; resources: clubs, teams, competitions,
      seasons, leagues, fixtures, tables. Catalog resources (competitions → leagues → teams) drive
      Sanity's cascading onboarding dropdowns. Multi-tenant scoping. (→ 0007, 0012)
- [ ] **Edge caching** — Cloudflare cache TTLs per resource, aligned to scrape cadence.
      (→ 0003, 0007)
- [ ] **Generated client** — publish typed client from the OpenAPI spec. (→ 0007)

## Phase 5 — WSC migration (lives in williamstownsc repo)

- [ ] **Plan in WSC** — swap local JSON (`matchService`/`tableService`/`clubService`) for the
      matchday API client; keep the same rendered output. (separate plan in that repo)
- [ ] **Cutover + decommission** — remove WSC crawl/sync scripts once API is authoritative.

---

## Open questions / later

- Final scraper host (thanos vs managed browser) — decide after a crawl-reliability check. (0009)
- Per-job cron mechanism. (0003, 0009)
- Auth/rate-limiting for the public API (tenant keys?) — no ADR yet.
- Multi-source ingest beyond Dribl — strategy set by 0012 (source-abstracted crawler); a second
  source adapter (e.g. Masters federation) is a later build.
- Player-level match stats — deferred. (0004)
