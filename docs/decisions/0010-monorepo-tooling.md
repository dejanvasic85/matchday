# 0010. Monorepo tooling

- Status: decided
- Date: 2026-07-12

## Context

0001 commits matchday to a single monorepo holding the scraper, the API, shared domain code
(entities, Zod schemas, database layer) and infrastructure. We need a package manager, and
possibly a task runner, to manage several workspaces, shared dependencies, and build and test
orchestration. williamstownsc already uses **pnpm**, so we know it.

Since we first made this decision, VoidZero released **Vite+**, an MIT-licensed unified web
toolchain, currently in beta. It puts Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown and Vite Task
behind a single `vp` command. `vp run` executes monorepo tasks with caching and per-package
config overrides, which is the role Turborepo would otherwise fill, and it folds lint, format,
test and build into the same tool. It does **not** replace the package manager: we still need
pnpm workspaces to install and link.

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

**pnpm workspaces plus Vite+**, from the outset. pnpm installs and links, which matches WSC.
Vite+ is the single toolchain for cached, parallel task orchestration, and for lint, format, test
and build across packages. That collapses what would otherwise be Turborepo plus a separate
lint, format and test stack into one tool.

We accept Vite+'s beta status as a considered risk. The downside stays limited, because pnpm
workspaces remain the load-bearing layer, and we can swap Vite+ for Turborepo or plain pnpm
scripts if it does not hold up.

The initial workspace layout we proposed:

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

The shape held, with two changes as the repo grew: `apps/scraper` became `apps/cli` (the `mday`
crawler and administration surface, per 0014), and `packages/sdk` was added for the published
typed client.

## Consequences

- `pnpm-workspace.yaml` sits at the repo root and handles install and linking.
- A root `vite.config.ts` defines shared lint, format and test defaults, with per-package
  `overrides`. Tasks run through `vp run`, with caching.
- Vite+'s bundled Oxlint and Oxfmt replace a separately configured ESLint and Prettier stack.
  Vitest runs the tests.
- Shared code lives in `packages/*`, and anything we deploy lives in `apps/*`.
- The choice matches what we already know from williamstownsc.
- We pin the Node version through `engines.node` and `devEngines.runtime` in `package.json`,
  which pnpm and Vite+ resolve. We need no separate runtime manager, which superseded an initial
  Mise pin (#74).
- Vite+ is beta, so pin its version. Revisit this ADR if it breaks compatibility, or if gaps show
  up in backend or Cloudflare Workers workflows.
