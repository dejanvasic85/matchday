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

- [ ] **Monorepo scaffold** — pnpm workspaces + Vite+ (`vp`); `apps/{api,scraper}`,
  `packages/{domain,db}`, `infra/`. Root `pnpm-workspace.yaml`, `vite.config.ts`. (→ 0010)
- [ ] **Node/runtime + Mise** — pin Node (and Bun if used for scraper) via Mise, matching WSC.
- [ ] **TypeScript config** — shared base `tsconfig`, per-package extends, strict mode,
  path aliases. (→ 0008)
- [ ] **Lint/format** — ESLint + Prettier (100-char width per WSC), lint-staged + Husky
  pre-commit.
- [ ] **Testing setup** — pick a runner (Vitest likely; Bun test if scraper on Bun). Define
  where unit vs integration tests live. No E2E framework decision yet.
- [ ] **Engineering standards doc** — `AGENTS.md` + `CLAUDE.md` for matchday: code style
  (no helpers/utils, services/mappers, camelCase constants), commands, workflow (format →
  lint → type:check → build → test). Adapt from WSC's AGENTS.md.
- [ ] **Agent skills / instructions** — port/author skills relevant to matchday (e.g. a
  dribl-crawling skill, a schema/migration skill); decide which WSC skills carry over.
- [ ] **CI** — GitHub Actions: install, lint, type-check, test on PR. (repo must be on GitHub)
- [ ] **Env/config** — zod-validated config module per app; `.env.example`; secrets strategy
  for Workers (wrangler) + scraper (thanos).

## Phase 1 — Data model & schema (keystone)

- [ ] **0011 data-model ADR** — `docs/decisions/0011-data-model.md`: entities (club, team,
  competition, season, fixture, ladder_entry, tracked_competition, external_ref), fields
  from 0004, relationships, ID prefixes from 0005. Unblocks everything below. (→ 0004,0005,0006)
- [ ] **DB package + Drizzle** — `packages/db`: Drizzle schema modelling 0011, migrations,
  Neon connection (serverless driver / Hyperdrive). (→ 0006, 0009)
- [ ] **Neon project setup** — create/confirm Neon project + branches (dev/prod); run first
  migration. (→ 0009)

## Phase 2 — Domain

- [ ] **Domain package** — `packages/domain`: Zod schemas for entities, prefixed-nanoid ID
  service (`clb_`/`tea_`/`cmp_`/`sea_`/`mtc_`/`lad_`), branded ID types. (→ 0004, 0005)
- [ ] **Transformers** — Dribl raw → domain (port WSC's transform/mapper logic).

## Phase 3 — Scraper

- [ ] **Crawler core** — port WSC playwright-core crawler; Cloudflare bypass via browser
  context; browser endpoint abstracted (thanos local ↔ managed fallback). (→ 0009)
- [ ] **Clubs sync job** — full `list/clubs` crawl → upsert clubs by external_ref. Daily.
  (→ 0003)
- [ ] **Competition crawl job** — competition-keyed; fixtures + results + ladders in one pass;
  upsert by external_ref; logo mirroring to R2. Fixture-derived match-window cadence.
  (→ 0002, 0003, 0004)
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
