# 0010. Monorepo tooling

- Status: decided
- Date: 2026-07-12

## Context

0001 commits matchday to a single monorepo holding the scraper, the API, shared domain code
(entities, Zod schemas, DB layer), and infra. We need a package manager and, optionally, a
task runner to manage multiple workspaces, shared dependencies, and build/test orchestration.
williamstownsc already uses **pnpm**, so the team is familiar with it.

Since the original decision, **Vite+** (VoidZero, MIT-licensed, currently beta) was released as
a unified web toolchain that bundles Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown, and Vite
Task behind a single `vp` CLI. It runs monorepo tasks (`vp run`) with caching and per-package
config overrides — the role Turborepo would otherwise fill — while also folding lint, format,
test, and build into one tool. It does **not** replace the package manager; pnpm workspaces
are still needed for install/linking.

## Options

- **pnpm workspaces + Vite+ (recommended)** — pnpm for install/linking, Vite+ as the single
  toolchain for task orchestration, lint, format, test, and build.
  - Pros: one tool for everything downstream of install (task caching, lint/format/test/build);
    matches pnpm familiarity from WSC; MIT/free; far less config than a separate task runner
    plus separate lint/format/test toolchains.
  - Cons: beta maturity — API and behaviour may still shift; sweet spot is frontend, so some
    features (Vite dev server, web bundling) are unused by a backend-only repo today.
- **pnpm workspaces + Turborepo** — pnpm for install/linking, Turborepo for task
  orchestration and caching.
  - Pros: stable and battle-tested; widely used and TS-friendly.
  - Cons: only solves task orchestration — lint/format/test tooling still assembled separately;
    two tools plus additional config.
- **pnpm workspaces only** — no task runner initially.
  - Cons: manual cross-package task running; no build cache.
- **Nx** — richer generators and dependency graph.
  - Cons: heavier, more opinionated than needed for a small repo.

## Recommendation

**pnpm workspaces + Vite+** from the outset. pnpm for install/linking (matches WSC), Vite+ as
the single toolchain for cached/parallel task orchestration plus lint, format, test, and build
across packages. This collapses what would otherwise be Turborepo + a separate lint/format/test
stack into one tool. We accept Vite+'s beta status as a considered risk; the downside is limited
because pnpm workspaces remain the load-bearing layer and Vite+ can be swapped for Turborepo (or
plain pnpm scripts) if it doesn't hold up.

Proposed initial workspace layout:

```
matchday/
  apps/
    api/            # REST API (0007)
    scraper/        # Dribl crawler + scheduler (0002, 0003)
  packages/
    domain/         # entities, Zod schemas, shared types (0004, 0005)
    db/             # Postgres schema, migrations, data access (0006)
  infra/            # deployment/infra config (0009)
  docs/decisions/   # ADRs
```

## Consequences

- `pnpm-workspace.yaml` at the repo root for install/linking.
- Root `vite.config.ts` defining shared `lint`/`fmt`/test defaults, with per-package
  `overrides`; tasks run via `vp run` with caching.
- Vite+'s bundled Oxlint/Oxfmt replace a separately configured ESLint/Prettier stack;
  Vitest is the test runner.
- Shared code lives in `packages/*`, deployables in `apps/*`.
- Consistent with williamstownsc's pnpm familiarity.
- Node version pinned via `engines.node` / `devEngines.runtime` in `package.json`, resolved by
  pnpm/Vite+ — no separate runtime manager (superseded an initial Mise pin, #74).
- Vite+ is beta: pin its version and revisit this ADR if breaking changes or gaps in
  backend/CF-Workers workflows surface.
