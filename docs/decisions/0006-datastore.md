# 0006. Datastore

- Status: decided
- Date: 2026-07-12

## Context

Current storage is **per-team JSON documents** on disk (`data/matches/<team>.json`,
`data/table/<team>.json`, plus a single `data/clubs/clubs.json`). This duplicates data across
files (a fixture appears in both teams' files), can't join across entities, and made
multi-tenant/shared queries awkward. Competition data is inherently relational:
clubs ↔ teams ↔ competitions ↔ seasons ↔ fixtures ↔ table entries.

## Options

- **Relational (Postgres) (chosen)** — normalized entities with foreign keys.
  - Pros: natural joins, dedup, ordering, multi-tenant filtering; strong constraints;
    idempotent upserts via external-ref keys (0005); hosted on Neon (0009).
  - Cons: bigger shift from JSON docs; migrations to manage.
- **Document DB** — closer to current model.
  - Pros: simple writes, familiar per-team shape.
  - Cons: joins/dedup/cross-club queries awkward — the exact pain already hit.

## Recommendation

**Relational Postgres.** Model clubs, teams, competitions, seasons, fixtures, table entries,
and an `external_ref` mapping (per 0005) as tables with foreign keys. A fixture is stored once
and joined to both teams.

## Consequences

- Introduces schema + migrations tooling.
- Enables efficient multi-tenant and cross-club queries and a stable API surface.
- Hosted on Neon (see 0009); reached from Workers via serverless driver / Hyperdrive.
- Ingest becomes upserts keyed on external refs rather than file writes.
