# 0005. Identifiers

- Status: decided
- Date: 2026-07-12
- Reshaped by: [0011](0011-data-model.md) — finalises the prefix list this ADR left open, adding
  `lea_`, `ext_` and `trk_`, and settles `external_ref` as a real table.

## Context

Today every entity keys off **Dribl hash IDs**: `clubs.json.externalId`, the fixture's
`homeTeamId` and `awayTeamId` (club hashes), the table's `teamId` (team hashes), and the
fixture's `hash_id`. We own no IDs of our own.

That is brittle. It couples the whole data model to one source, it mixes two ID namespaces (club
against team hashes), and it makes both a second data source and a Dribl schema change painful.
It has already cost us real friction — `findDuplicateClubIds` exists because teams share a club
hash.

## Options

- **Our own IDs, plus an external-reference mapping (chosen)** — we own the primary key for every
  entity, and store each external source ID in a mapping so re-scraping stays idempotent.
- **Keep external IDs as primary keys** — simplest in the short term, but locked to one source
  and fragile.
- **Composite external keys** — encode the namespace into the key. Still locked to one source.

### Primary ID format

- **Prefixed nanoid (chosen)** — Stripe-style, such as `clb_V1StGXR8Z5`, `tea_…`, `cmp_…`,
  `sea_…`, `mtc_…`. We generate these in TypeScript, per 0008. They describe themselves, read
  well in URLs and logs, resist collisions, and their prefix makes a mixed-up ID type obvious.
- **A UUID primary key plus a slug** — stable, but we would manage two identifiers, and keeping
  slugs unique is fiddly.
- **A slug as the primary key** — renames and collisions get painful, and a slug is not unique
  across seasons and competitions.

Proposed prefixes: `clb_` club, `tea_` team, `cmp_` competition, `sea_` season, `mtc_`
match/fixture, `tab_` table entry. 0011 finalises the full list during schema design.

## Recommendation

**App-owned prefixed-nanoid primary IDs, with a stored external reference mapping.** Each
entity gets an in-app generated ID like `clb_xxxxxxxxxx`. External identity lives in a
mapping, e.g.:

```
external_ref (entity_type, internal_id, source, source_id)
  -- source = 'dribl', source_id = '<hash>'
```

The scraper upserts by `(source, source_id)` to find the internal ID, which keeps ingest
idempotent. The API exposes the prefixed IDs directly, and treats Dribl hashes as an
implementation detail.

## Consequences

- Our internal model separates cleanly from Dribl.
- Adding another source later stays straightforward.
- Ingest keys its upsert and matching logic on external references.
- Consumers such as williamstownsc must move from Dribl-hash lookups to matchday prefixed IDs.
- We add a small ID service in `packages/domain` — nanoid plus a prefix map, per 0010.
- The prefixes act as lightweight type tags. Consider a branded TypeScript type per entity ID.
