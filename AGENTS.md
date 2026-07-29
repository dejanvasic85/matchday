# AGENTS Guide

Baseline engineering conventions for agents working in matchday. Keep the bar high: clean,
maintainable, strongly-typed, well-tested code — every change is judged on maintainability, not
just "it works".

## Project context

matchday is a **multi-tenant sports competition data service** — it scrapes Dribl fixtures,
results and league tables and serves them via an API so multiple clubs consume one dataset. It is
a **backend + CLI crawler; there is no UI in this repo.**

pnpm + Vite+ monorepo:

- `apps/api` — REST API
- `apps/cli` — `mday` CLI: crawler + scheduler, one subdirectory per source under
  `src/crawlers/` (`dribl/` today, including its Dribl-specific external schemas + mappers —
  nothing source-specific lives outside its own `crawlers/<source>/` folder)
- `packages/domain` — Zod schemas, entity types, ID service (source-agnostic; no Dribl knowledge)
- `packages/db` — Drizzle schema, migrations, per-entity data access
- `infra/` — deployment/infra config

The **ADRs in `docs/decisions/` are the source of truth**; read the relevant one before a change.
The build backlog lives in **GitHub Issues** (`gh issue list`), grouped by phase milestones and
tagged with `phase:N` / `adr:NNNN` labels. `docs/todo.md` is now just a pointer to it.

## Tech stack (from ADRs — target this stack)

- **Language:** TypeScript everywhere, ESM, `strict`.
- **API:** **Hono on Cloudflare Workers**; REST + OpenAPI via `@hono/zod-openapi` (one Zod source
  drives validation and the spec). Consumers generate typed clients from the spec.
- **Database:** **Postgres on Neon**, via **Drizzle**. From a Worker, reach it through the Neon
  serverless driver / Hyperdrive — **never a raw `pg` TCP connection from a V8 isolate**.
- **Scraper:** **playwright-core** with real Chrome to clear Dribl's Cloudflare, then direct
  `mc-api.dribl.com` calls. The browser endpoint is abstracted (thanos primary ↔ managed-browser
  fallback) so switching is a config change, not a rewrite. See the `dribl-crawling` skill.
- **Identifiers:** app-owned **prefixed-nanoid** primary IDs (`clb_`/`tea_`/`cmp_`/`sea_`/`lea_`/`mtc_`/`tab_`);
  external identity lives in an `external_ref (source, source_id)` mapping. Ingest **upserts by
  `(source, source_id)`** for idempotent re-scraping. Prefer branded ID types. The ID service lives in
  `packages/domain`.
- **Assets:** club logos on **Cloudflare R2**; edge caching on Cloudflare.

## Vite+ workflow (required)

`vp` is the default interface for all core tooling — do not bypass it. pnpm workspaces are the
install/link layer underneath.

- `vp dev` — local development
- `vp check` — lint + format + type-check
- `vp test` — run tests (`vp test --coverage` for coverage)
- `vp build` — production build
- `vp run <script>` — a custom `package.json` script. To run a package's script from the repo
  root, select the package with `--filter` (a bare path arg is passed to the task, not used as a
  selector): `vp run --filter @matchday/db db:migrate`, or `cd packages/db && vp run db:migrate`.
- `vp add` / `vp remove` — manage dependencies

## Local development / database

- **There is no local Docker Postgres.** Local dev uses a **Neon `matchday-dev`** database
  (`matchday` is prod). Both are reached through the **neon-http/serverless driver**, which speaks
  Neon's HTTP/WebSocket protocol — it **cannot** connect to a raw-TCP local Postgres, so don't
  introduce one or add a `pg` driver for it.
- **Migrations** run via drizzle-kit: `cd packages/db && vp run db:migrate`. `drizzle.config.ts`
  auto-loads `packages/db/.env.local` (gitignored) — put the **dev** `DATABASE_URL` there (Neon
  **pooled** host, `?sslmode=require`). Never run migrations against prod locally: prod migrations
  run only in CI (`.github/workflows/deploy.yml`, on push to `main`) from the `DATABASE_URL` secret.

## Quality gates (before every PR/push)

Run in order; never push red:

1. `vp check`
2. `vp test` — if any source or test files changed
3. `vp build` — for larger or riskier changes

Pre-commit runs via Vite+ staged checks; include any auto-fixes in the commit.

## Slice workflow (multi-slice / phased work)

When picking up an issue that's naturally built as a sequence of slices (e.g. an issue broken into
mapper → crawler → resolution → wiring), work one slice at a time and close the loop on each
before starting the next:

1. Implement the slice (code + tests), passing the quality gates above.
2. Keep the issue current **in the same PR that lands the slice** — tick the slice's checkbox in
   the issue body (or comment on progress), and reference the issue from the PR (`Refs #N`, or
   `Closes #N` on the last slice) so merging updates it. A merged slice with a stale issue is the
   single most common way the backlog drifts from reality and misleads the next planning pass.
3. Run the `caveman-review` skill against the slice's diff.
4. Fix the issues it surfaces (or explicitly note why a finding doesn't apply — don't silently
   drop one).
5. Push and open a PR; wait for CI checks.
6. If checks fail: fix, **run `caveman-review` on the fix-up diff too** (a CI fix is still a code
   change — don't push anything, including a one-line fix-up commit, without a review pass), push,
   and repeat from step 5 until checks pass. Address what it surfaces, or push back with an
   explanation if a finding doesn't apply — silently dropping one isn't acceptable either way.
7. Merge the PR once green.
8. Cut a **fresh branch off latest `main`** for the next slice — don't keep stacking unrelated
   slices on one branch.

This keeps each slice small, independently reviewable, and validated by CI before the next slice
builds on top of it, rather than accumulating a large uncheckable stack of commits.

## Architecture & error handling

- **Functional style — no classes / OO.** Small single-purpose functions; `switch` over long
  `if/else` chains when branching on one discriminator.
- **`Result<T, E>` over throwing.** A shared `ok`/`err` primitive in `packages/domain`. Data-access
  returns `Result`; services map data-access errors to domain outcomes, also returning `Result`.
  Reserve throwing for genuine programmer errors and the outermost transport boundary.
- **Separate data-access from business logic** so logic is unit-testable in isolation:
  - **Data access** — Drizzle query functions in `packages/db`, one module per entity
    (`clubDb.ts`, `leagueDb.ts`, ...); build a query, execute, return a `Result` of rows. No
    business rules here.
  - **Services** — all business logic (mappers, decisions, orchestration); **pure**, receiving
    collaborators (data-access, logger, clock, notifiers) **by argument** so tests pass fakes. This
    is the unit-tested layer.
  - **Transport** — thin Hono handlers / CLI jobs that construct the real dependencies and call
    the service. Keep it glue-only.
- **No verb-first file/module names.** A module is named after the thing it's about
  (`clubDb.ts`, `clubResolver.ts`, `catalogCrawler.ts`); verbs belong to the functions inside
  (`upsertClub`, `resolveClub`, `crawlCatalog`). Exported function/type names are unaffected by
  this rule — only the file name changes.
- **Mappers** are explicit named transform functions at the source-raw→domain boundary,
  Zod-validated on both sides, living alongside their source's other code under
  `apps/cli/src/crawlers/<source>/mappers/` (nothing source-specific lives in `packages/domain`).
- **Structured logging:** an injected logger `{ debug, info, warn, error }` where each takes
  `(event, msg, fields?)`. Events are dotted namespaces (`"crawl.competition"`, `"api.club.get"`).
  Emit one JSON line in prod; route `warn`/`error` through `console.warn`/`console.error` so
  Cloudflare Workers Logs classifies them. Inject it as a dependency so tests assert on log calls.

## Code style

- **Never create `helpers`/`utils` dumping grounds** — use services, mappers, transformers.
- **camelCase constants — never SCREAMING_CASE.** Object constants get a `Value` suffix
  (`defaultConfigValue`). Group related constants in one `as const` object in a co-located
  `constants.ts`; only lift to a shared module when used across domains.
- **No `as` casting.** No `as unknown as` or escape hatches — they hide runtime errors and defeat
  the type system; fix the root type instead (add a type guard, correct a source type, narrow after
  a check). This is **enforced by lint** (`typescript/no-unsafe-type-assertion` and
  `typescript/consistent-type-assertions` are errors). The only sanctioned `as` is narrowing a
  known-safe union after a guard, or working around a wrong external-library type — with an inline
  `oxlint-disable` comment explaining why.
- TypeScript module filenames are **camelCase** (`fixtureTransformService.ts`).
- Prefer **alias imports** over deep relative paths.
- Avoid magic numbers/strings — name them. Comments only for non-obvious intent; never commented-out
  code.
- **Zod** for validation schemas and for **env/config**: a Zod-validated config module per app. Env
  vars are documented in `.env.example` only — never listed in docs or README files.

## Unit testing

With no UI, unit tests are the primary safety net — hold them to a high standard.

- **Vitest via `vp test`**, `environment: 'node'`. `describe`/`it`/`test`/`expect`/`vi` are
  **globals** — do not import them. `clearMocks: true` is set globally; do not call
  `vi.clearAllMocks()` in `beforeEach`.
- **Co-locate** tests next to source as `*.test.ts`, mirroring the source filename (camelCase).
  Discovery is `**/*.test.ts`. Any future Playwright/e2e specs live in a separate top-level dir as
  `*.spec.ts`, outside the Vitest glob.
- **Shared fixture factories:** build domain-model test data with `makeX(overrides: Partial<T> = {})`
  factories in a `test/fixtures/` module per package (imported via alias). Fill sensible defaults;
  pass only the fields a test asserts on via `overrides`. Entities with a snake_case DB-row variant
  also expose `makeXRow` for data-access fakes.
- **DI over mocking the DB:** unit-test services by passing hand-built fakes (a `vi.fn()` per
  data-access method) — do **not** `vi.mock` Drizzle/Neon. Where a module mock is unavoidable, put
  `vi.mock(...)` at the file top and use `vi.mocked(fn)` per test (type-safe, no casts). Validate at
  Zod boundaries.
- **Structure:** Arrange / Act / Assert, one behaviour per `it`, a failing test name should pinpoint
  the break. Assert on `Result` outcomes (`expect(result).toEqual(ok({...}))` / `err({...})`) and on
  injected-logger calls.
- **What to test:** services, mappers/transformers, the ID service, config parsing, upsert/dedup
  logic. Don't test framework internals or thin transport glue.
- **Coverage:** run `vp test --coverage` (v8); exclude generated/wiring files in `vite.config.ts`
  rather than writing throwaway tests to lift a number. (Threshold TBD in the testing-setup task.)

## Dependency management

- Check for the current stable version before adding a dependency; avoid deprecated packages/APIs.
- **Pin exact versions — no `^`/`~`.** Renovate manages upgrades; use the `renovate-pr` skill to fix
  failing Renovate PRs.

## Plans

- Store plans as `docs/plans/YYYY-MM-DD-description.md`; keep the tracking GitHub issue current as
  work lands.
- Keep plans concise: Purpose, Requirements, an ordered todo list, and any open questions at the end.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
