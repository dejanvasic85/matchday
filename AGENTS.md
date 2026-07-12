# AGENTS Guide

Baseline engineering conventions for agents working in matchday. Keep the bar high: clean,
maintainable, strongly-typed, well-tested code — every change is judged on maintainability, not
just "it works".

## Project context

matchday is a **multi-tenant sports competition data service** — it scrapes Dribl fixtures,
results and ladder tables and serves them via an API so multiple clubs consume one dataset. It is
a **backend + scraper; there is no UI in this repo.**

pnpm + Vite+ monorepo (→ 0010):

- `apps/api` — REST API (→ 0007)
- `apps/scraper` — Dribl crawler + scheduler (→ 0002, 0003)
- `packages/domain` — Zod schemas, entity types, ID service, Dribl→domain mappers (→ 0004, 0005)
- `packages/db` — Drizzle schema, migrations, data access (→ 0006)
- `infra/` — deployment/infra config (→ 0009)

The **ADRs in `docs/decisions/` are the source of truth**; read the relevant one before a change.
`docs/todo.md` is the sequenced build backlog.

## Tech stack (from ADRs — target this stack)

- **Language:** TypeScript everywhere, ESM, `strict` (→ 0008).
- **API:** **Hono on Cloudflare Workers**; REST + OpenAPI via `@hono/zod-openapi` (one Zod source
  drives validation and the spec). Consumers generate typed clients from the spec (→ 0007).
- **Database:** **Postgres on Neon**, via **Drizzle**. From a Worker, reach it through the Neon
  serverless driver / Hyperdrive — **never a raw `pg` TCP connection from a V8 isolate** (→ 0006, 0009).
- **Scraper:** **playwright-core** with real Chrome to clear Dribl's Cloudflare, then direct
  `mc-api.dribl.com` calls. The browser endpoint is abstracted (thanos primary ↔ managed-browser
  fallback) so switching is a config change, not a rewrite (→ 0009). See the `dribl-crawling` skill.
- **Identifiers:** app-owned **prefixed-nanoid** primary IDs (`clb_`/`tea_`/`cmp_`/`sea_`/`mtc_`/`lad_`);
  external identity lives in an `external_ref (source, source_id)` mapping. Ingest **upserts by
  `(source, source_id)`** for idempotent re-scraping. Prefer branded ID types. The ID service lives in
  `packages/domain` (→ 0005).
- **Assets:** club logos on **Cloudflare R2**; edge caching on Cloudflare (→ 0004, 0009).

## Vite+ workflow (required)

`vp` is the default interface for all core tooling — do not bypass it. pnpm workspaces are the
install/link layer underneath.

- `vp dev` — local development
- `vp check` — lint + format + type-check
- `vp test` — run tests (`vp test --coverage` for coverage)
- `vp build` — production build
- `vp run <script>` — a custom `package.json` script
- `vp add` / `vp remove` — manage dependencies

## Quality gates (before every PR/push)

Run in order; never push red:

1. `vp check`
2. `vp test` — if any source or test files changed
3. `vp build` — for larger or riskier changes

Pre-commit runs via Vite+ staged checks; include any auto-fixes in the commit.

## Architecture & error handling

- **Functional style — no classes / OO.** Small single-purpose functions; `switch` over long
  `if/else` chains when branching on one discriminator.
- **`Result<T, E>` over throwing.** A shared `ok`/`err` primitive in `packages/domain`. Data-access
  returns `Result`; services map data-access errors to domain outcomes, also returning `Result`.
  Reserve throwing for genuine programmer errors and the outermost transport boundary.
- **Separate data-access from business logic** so logic is unit-testable in isolation:
  - **Data access** — Drizzle query functions in `packages/db`; build a query, execute, return a
    `Result` of rows. No business rules here.
  - **Services** — all business logic (mappers, decisions, orchestration); **pure**, receiving
    collaborators (data-access, logger, clock, notifiers) **by argument** so tests pass fakes. This
    is the unit-tested layer.
  - **Transport** — thin Hono handlers / scraper jobs that construct the real dependencies and call
    the service. Keep it glue-only.
  This is a principle, not a rigid file-naming scheme — the DB layer is a Drizzle package, not
  per-entity files.
- **Mappers** are explicit named transform functions at the Dribl-raw→domain boundary, Zod-validated
  on both sides, living in `packages/domain` (→ Phase 2).
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

- Store plans as `docs/plans/YYYY-MM-DD-description.md`; keep `docs/todo.md` current as work lands.
- Keep plans concise: Purpose, Requirements, an ordered todo list, and any open questions at the end.
