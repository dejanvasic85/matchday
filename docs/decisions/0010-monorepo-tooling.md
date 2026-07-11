# 0010. Monorepo tooling

- Status: decided
- Date: 2026-07-12

## Context

0001 commits matchday to a single monorepo holding the scraper, the API, shared domain code
(entities, Zod schemas, DB layer), and infra. We need a package manager and, optionally, a
task runner to manage multiple workspaces, shared dependencies, and build/test orchestration.
williamstownsc already uses **pnpm**, so the team is familiar with it.

## Options

- **pnpm workspaces + Turborepo (recommended)** — pnpm for install/linking, Turborepo for
  task orchestration and caching across packages.
  - Pros: fast, disk-efficient installs (pnpm); cached/parallel builds and tests (Turbo);
    both widely used and TS-friendly; matches existing WSC toolchain.
  - Cons: two tools to learn; Turbo config overhead — minor at this scale.
- **pnpm workspaces only** — no task runner initially.
  - Pros: simplest; add Turbo later if orchestration hurts.
  - Cons: manual cross-package task running; no build cache.
- **Nx** — richer generators and dependency graph.
  - Cons: heavier, more opinionated than needed for a small repo.

## Recommendation

**pnpm workspaces + Turborepo** from the outset. pnpm for install/linking (matches WSC),
Turborepo for cached/parallel build and test orchestration across packages.

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

- `pnpm-workspace.yaml` + `turbo.json` at the repo root.
- Shared code lives in `packages/*`, deployables in `apps/*`.
- Consistent with williamstownsc's pnpm familiarity.
- Node version pinned (Mise, matching WSC) in a later setup step.
