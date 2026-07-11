# 0005. Identifiers

- Status: proposed
- Date: 2026-07-12

## Context

Today every entity keys off **Dribl hash IDs** — `clubs.json.externalId`, fixture
`home/awayTeamId` (club hashes), ladder `teamId` (team hashes), fixture `hash_id`. There are
no application-owned IDs. This is brittle: it couples the whole data model to one source, mixes
ID namespaces (club vs team hashes), and makes a second data source or a Dribl schema change
painful. It also caused real friction (e.g. `findDuplicateClubIds` where teams share a club
hash).

## Options

- **Own IDs + external ref mapping (recommended)** — app-owned primary keys (UUID or slug)
  for every entity, with external source IDs stored as a mapping for idempotent re-scraping.
- **Keep external IDs as primary keys** — simplest short term, but source-locked and fragile.
- **Composite external keys** — encode namespace into the key; still source-locked.

## Recommendation

**App-owned primary IDs, with a stored external reference mapping.** Each entity
(club, team, competition, season, fixture) gets an internal ID. External identity lives in a
mapping, e.g.:

```
external_ref (entity_type, internal_id, source, source_id)
  -- source = 'dribl', source_id = '<hash>'
```

Scraper upserts by `(source, source_id)` → internal ID for idempotency. API exposes internal
IDs (and optionally slugs); Dribl hashes are an implementation detail.

## Consequences

- Clean separation of internal model from Dribl.
- Straightforward path to additional sources later.
- Upsert/matching logic keys on external refs during ingest.
- Consumers (e.g. williamstownsc) migrate from Dribl-hash lookups to matchday IDs/slugs.
