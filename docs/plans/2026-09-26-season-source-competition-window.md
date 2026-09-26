# Season scope and competition windows

- Date: 2026-09-26

## Purpose

Give a season a home: a season belongs to a **source**, and the calendar window belongs to a
competition's run in that season. This removes the global season row whose single window is wrong
for every competition but one, and retires the global season lookup.

The decision is recorded in a new ADR under `docs/decisions/`.

## Requirements

- `season` has a `source` column, unique on `(source, name)`, so two sources' `2026`s are
  distinguishable by the schema.
- `competition_season` (unique on `(competition_id, season_id)`) owns `starts_on` / `ends_on`.
- Dates live only on `competition_season`; `season` keeps none.
- Season lookups take a source; no source-wide "latest season" lookup remains.
- Existing data is backfilled: `season.source` from `external_ref`, and one `competition_season` per
  existing `(competition, season)` copying the season's current dates.
- `league` keeps `(competition_id, season_id)`; its window is read through the competition-season.

## Plan

Two pull requests. The first is expand-only and reversible; the second contracts.

### PR 1 — Season gets a source; the window moves to the competition

- [x] Decision record: new ADR, plus "reshaped by" notes on the data-model and multi-source ADRs.
- [x] Domain: `season` gains `source`; new `competitionSeason` entity; new `cse_` id prefix.
- [x] DB schema: `season.source` + unique `(source, name)`; `competition_season` table + unique
      `(competition, season)`; relations. Leave the old season date columns declared for now.
- [x] Migration + backfill: add and fill `season.source`; create the table; insert one row per
      existing `(competition, season)` copying the season dates; add the unique indexes.
- [x] Data access: source-scoped season lookups; new `competitionSeasonDb`; competition lookup by
      name; `leagueDb` and `subscriptionDb` read the window from the competition-season.
- [x] Crawler: thread the crawl source through persistence; write `season.source`; ensure a
      competition-season per league; the undated warning checks the competition-season.
- [x] CLI: source-scoped `resolveSeason`; `season set-dates` targets a competition; flat
      `season list` showing season, competition and window; pass the source through the club and
      client commands.
- [x] Tests and fixtures updated; cover two competitions sharing one season name with different
      windows.

### PR 2 — Contract: remove the old season dates

- [ ] Drop `starts_on` / `ends_on` from `season` (schema + migration).
- [ ] Delete dead code, comments and fixtures left over from the old columns.
- [ ] Final pass on the ADR cross-references and the tracking issue.

## Open questions

- `season list` output shape: settled on a flat season + competition + window table, to read easily
  and to pipe into `jq`.
- The migration generates `cse_` ids in SQL. The app only checks the prefix, so a hashed id is safe.
