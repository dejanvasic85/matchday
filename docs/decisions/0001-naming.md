# 0001. Naming

- Status: decided
- Date: 2026-07-12

## Context

The fixtures/results/tables functionality is being extracted from `williamstownsc` into a
standalone, multi-tenant service so other clubs can be onboarded. It needs a name that is
club-agnostic, clearly sports-related, short, and brandable enough to grow into a product.

## Options

- **matchday** — club-agnostic, clearly sports data, short, brandable.
- `fixtures-api` — descriptive but generic and locked to one concept.
- Abstract/sporty brands (Pitchside, Sideline, Kickoff) — brandable but less literal.

## Recommendation

**`matchday`**, as a **single monorepo** containing the scraper, the API, and infrastructure.
No suffixes (`-api`, `-core`) — one repo covers all tools.

## Consequences

- Repo/package name: `matchday`.
- Monorepo tooling (pnpm workspaces / turborepo) to be decided separately.
- Room to grow into a product other clubs adopt.
