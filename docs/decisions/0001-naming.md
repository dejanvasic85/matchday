# 0001. Naming

- Status: decided
- Date: 2026-07-12

## Context

We are pulling the fixtures, results and tables features out of `williamstownsc` into a
standalone, multi-tenant service, so we can onboard other clubs. It needs a name that works for
any club, reads as sports data, stays short, and could grow into a product name.

## Options

- **matchday** — works for any club, reads as sports data, short, brandable.
- `fixtures-api` — descriptive, but generic and tied to one concept.
- Abstract sporty names (Pitchside, Sideline, Kickoff) — brandable, but less literal.

## Recommendation

**`matchday`**, as a **single monorepo** holding the scraper, the API and the infrastructure. No
suffixes such as `-api` or `-core`, because one repo covers every tool.

## Consequences

- The repo and package are both called `matchday`.
- We still need to pick monorepo tooling. 0010 does that.
- The name leaves room to grow into a product other clubs adopt.
