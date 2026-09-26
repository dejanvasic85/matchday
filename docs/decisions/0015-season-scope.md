# 0015. A season belongs to a source; its window belongs to the competition

- Status: decided
- Date: 2026-09-26
- Reshapes: 0011 (data model), 0012 (multi-source)

## Context

0011 modelled `season` as one global table — `(id, name, starts_on, ends_on)` — with no source and no
competition. A `league` tied a competition to a season, and the only thing linking a season to a
source was its `external_ref` row.

The crawl already knows better. It reads the source's own season list (`list/seasons` is per tenant)
and selects a season by name. But the row it creates records neither the source nor the competition,
and one row can hold only one calendar window. Two things then go wrong:

- **Different competitions in one source run different calendars.** Dribl runs winter competitions
  (roughly Feb–Sep) and other competitions on other calendars. One window is wrong for all but one.
- **Names collide across sources.** Two sources can each hold a `2026`; only `external_ref` tells
  them apart, so any lookup by name alone is ambiguous.

The source's own shape is the clue: a season is a **federation-wide time label**, and the window is
a property of a **competition's run** inside it.

## Options

1. **Season belongs to a source.** `(source, name)` unique. Matches the source's season list, but
   one window per source still cannot hold per-competition calendars.
2. **Season belongs to a competition.** `(competition, name)` unique. Correct windows, but the
   source's season id is federation-wide: one source id would map to many internal seasons, breaking
   `external_ref (source, source_id)` as a one-to-one idempotency key. `--season` also stops
   resolving to a single row.
3. **Season belongs to a source; a separate competition-season owns the window.** One shared label,
   one note per competition saying when that competition runs it.

## Recommendation

Choose option 3.

- **`season`** gains a `source` column, unique on `(source, name)`. It keeps its `external_ref` to
  the source's own season id, so the crawler upserts it like every other entity and a source-side
  rename updates the name instead of forking a row.
- **`competition_season`** is new: unique on `(competition_id, season_id)`, carrying `starts_on` and
  `ends_on`. One row per competition's run in a season. The catalog crawl creates it — blank dates
  for Dribl, which gives none, and written straight away by a source that generates its own calendar.
- **Dates live only on `competition_season`.** `season` keeps no window, so there is one place to
  look and no "which date actually applied?" question.
- **`league`** keeps `(competition_id, season_id)`; its window is read through the competition-season.
- **Season lookups take a source.** `resolveSeason`, `findSeasonByName` and `findLatestSeason` become
  source-scoped, retiring the last global season lookup.

`mday season set-dates` gains a competition (and a source) to target, and `mday season list` shows
each season label with the windows of the competitions that run it.

## Consequences

- A new entity, table and id prefix (`cse_`), and a schema migration that adds `season.source`,
  creates `competition_season` and backfills both, followed by a migration that drops the season
  date columns.
- The backfill copies each season's current window onto one competition-season per existing
  `(competition, season)`. Every Dribl competition shares that window today, so the copy is correct;
  an operator splits out the exceptions afterwards.
- The deep crawl's subscription pruning judges each league on its own competition's window, so a
  winter league and a summer cup finish on different dates.
- The synthetic source plugs in without a special case: it creates its own season labels and writes
  their competition-season windows from its generated calendar.
- The API's season resource is unchanged (`id`, `name`); a league can expose its window from the
  competition-season when a consumer needs it.
