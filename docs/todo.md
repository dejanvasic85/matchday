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
      competition, season, fixture, ladder_entry, tracked_competition, external_ref), fields
      from 0004, relationships, ID prefixes from 0005. Unblocks everything below. (→ 0004,0005,0006)
- [x] **DB package + Drizzle** — `packages/db`: Drizzle schema modelling 0011, migrations,
      Neon connection (serverless driver / Hyperdrive). (→ 0006, 0009)
- [x] **Neon project setup** — create/confirm Neon project + branches (dev/prod); run first
      migration. (→ 0009)

## Phase 2 — Domain

- [x] **Domain package** — `packages/domain`: Zod schemas for entities, prefixed-nanoid ID
      service (`clb_`/`tea_`/`cmp_`/`sea_`/`lea_`/`mtc_`/`tab_`/`ext_`/`trk_`), branded ID types.
      (→ 0004, 0005, 0011)
- [ ] **Transformers** — Dribl raw → domain (port WSC's transform/mapper logic).

## Phase 3 — Scraper

- [ ] **Crawler core** — port WSC playwright-core crawler; Cloudflare bypass via browser
      context; browser endpoint abstracted (thanos local ↔ managed fallback); raw API
      responses written to R2 (7-day expiry) before transform, per updated 0004. (→ 0009)
- [ ] **Clubs sync job** — full `list/clubs` crawl → upsert clubs by external_ref. Daily.
      (→ 0003)
- [ ] **Competition crawl job** — competition-keyed; fixtures + results + ladders in one pass;
      raw responses staged to R2, then transformed and upserted by external_ref; logo
      mirroring to R2. Fixture-derived match-window cadence. (→ 0002, 0003, 0004)
- [ ] **tracked_competition registry** — seed from tenant teams; drives the crawl. (→ 0002)
- [ ] **Scheduling** — wire per-job triggers (thanos cron / GH Actions / CF Cron). (→ 0003, 0009)

## Phase 4 — API

- [ ] **Hono app on Workers** — `apps/api`; wrangler config; Neon access from the isolate.
      (→ 0007, 0009)
- [ ] **OpenAPI + routes** — `@hono/zod-openapi`; resources: clubs, teams, competitions,
      seasons, fixtures, tables. Multi-tenant scoping. (→ 0007)
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
- Multi-source ingest beyond Dribl — external_ref is ready for it (0005), no plan yet.
- Player-level match stats — deferred. (0004)
