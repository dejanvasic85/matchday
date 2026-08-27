# 0006. Datastore

- Status: decided
- Date: 2026-07-12

## Context

Today we store **per-team JSON documents** on disk: `data/matches/<team>.json`,
`data/table/<team>.json`, and one `data/clubs/clubs.json`. That duplicates data across files,
because a fixture appears in both teams' files. It cannot join across entities, and it has made
shared, multi-tenant queries awkward. Competition data is relational by nature: clubs ↔ teams ↔
competitions ↔ seasons ↔ fixtures ↔ table entries.

## Options

- **Relational Postgres (chosen)** — normalised entities with foreign keys.
  - Pros: joins, de-duplication, ordering and multi-tenant filtering all come naturally; strong
    constraints; idempotent upserts through the external-reference keys from 0005; Neon hosts it
    (0009).
  - Cons: a bigger shift from JSON documents, and migrations to manage.
- **A document database** — closer to what we have now.
  - Pros: simple writes, and a familiar per-team shape.
  - Cons: joins, de-duplication and cross-club queries stay awkward. That is the exact pain we
    already hit.

## Recommendation

**Relational Postgres.** Model clubs, teams, competitions, seasons, fixtures, table entries and
an `external_ref` mapping (0005) as tables with foreign keys. Store each fixture once and join it
to both teams.

## Consequences

- We need schema and migration tooling.
- Multi-tenant and cross-club queries become efficient, and the API surface stays stable.
- Neon hosts it (0009). Workers reach it through the serverless driver or Hyperdrive.
- Ingest becomes upserts keyed on external references, instead of file writes.
