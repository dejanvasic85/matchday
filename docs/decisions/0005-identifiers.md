# 0005. Identifiers

- Status: decided
- Date: 2026-07-12

## Context

Today every entity keys off **Dribl hash IDs** — `clubs.json.externalId`, fixture
`home/awayTeamId` (club hashes), ladder `teamId` (team hashes), fixture `hash_id`. There are
no application-owned IDs. This is brittle: it couples the whole data model to one source, mixes
ID namespaces (club vs team hashes), and makes a second data source or a Dribl schema change
painful. It also caused real friction (e.g. `findDuplicateClubIds` where teams share a club
hash).

## Options

- **Own IDs + external ref mapping (chosen)** — app-owned primary keys for every entity,
  with external source IDs stored as a mapping for idempotent re-scraping.
- **Keep external IDs as primary keys** — simplest short term, but source-locked and fragile.
- **Composite external keys** — encode namespace into the key; still source-locked.

### Primary ID format

- **Prefixed nanoid (chosen)** — Stripe-style, e.g. `clb_V1StGXR8Z5`, `tea_...`, `cmp_...`,
  `sea_...`, `mtc_...`. Generated in-app (TypeScript, per 0008), self-describing, readable in
  URLs/logs, collision-resistant, and the prefix makes ID-type mix-ups detectable.
- UUID PK + slug — stable but two identifiers to manage; slug uniqueness is fiddly.
- Slug as PK — renames/collisions painful; not unique across seasons/competitions.

Proposed prefixes: `clb_` club, `tea_` team, `cmp_` competition, `sea_` season,
`mtc_` match/fixture, `lad_` ladder entry (finalise during schema design).

## Recommendation

**App-owned prefixed-nanoid primary IDs, with a stored external reference mapping.** Each
entity gets an in-app generated ID like `clb_xxxxxxxxxx`. External identity lives in a
mapping, e.g.:

```
external_ref (entity_type, internal_id, source, source_id)
  -- source = 'dribl', source_id = '<hash>'
```

Scraper upserts by `(source, source_id)` → internal ID for idempotency. API exposes the
prefixed IDs directly; Dribl hashes are an implementation detail.

## Consequences

- Clean separation of internal model from Dribl.
- Straightforward path to additional sources later.
- Upsert/matching logic keys on external refs during ingest.
- Consumers (e.g. williamstownsc) migrate from Dribl-hash lookups to matchday prefixed IDs.
- Add a small ID service/module (nanoid + prefix map) in `packages/domain` (per 0010).
- Prefixes act as lightweight type tags; consider branded TS types per entity ID.
