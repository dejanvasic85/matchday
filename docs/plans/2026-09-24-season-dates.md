# Season start/end dates, per-source season resolution

Implements the first slice of the "Synthetic league" milestone (issue #255). Fixes a
prod-risk bug before it lands: a second source's season (e.g. `2026 Spring`) currently sorts
above Dribl's `2026`, becomes the global "current season", and `client sync-subscriptions
--apply` then deletes every real Dribl subscription.

## Purpose

- Give `season` `starts_on` / `ends_on` so a season's date range is data, not a name guess.
- Let `mday` resolve the current season **per club** (from the seasons that club's leagues
  belong to), not globally across every source.
- Prune a subscription only when _that club's_ season has finished.

## Requirements

- `season.starts_on` and `season.ends_on` are nullable `date` columns, added by migration.
- `mday season set-dates <name> --starts YYYY-MM-DD --ends YYYY-MM-DD` writes them.
- `mday season list [--json]` lists seasons with their dates.
- `mday catalog` warns (doesn't hard-fail) when a crawl creates a season with no dates.
- `resolveSeason` keeps its `--season <name>` path unchanged; with no name it resolves per club.
- `sync-subscriptions` removes a subscription only when the league's season ended
  before today; a season with no `ends_on` is never treated as finished.
- Overlapping seasons from two sources don't disturb each other's clients.

## Design notes

- **Explicit id resolution over fuzzy name lookup.** `syncSubscriptions` and
  `listSubscriptions` need a season _id_ to filter by, but the per-club rule has no single
  global answer. So their `--season` flag becomes an exact season-name lookup, and with no
  flag they pass no filter at all:
  - `listSubscriptions` with no `--season` already lists every season, so removing its
    season filter is a simplification, not a regression.
  - `syncSubscriptions` with no `--season` reconciles across every season the followed clubs
    play in. A finished season's leagues are excluded from additions, so the sync never
    re-subscribes what it just pruned.
- **Finish is a date comparison, not a name comparison.** `season.endsOn < today` replaces
  `row.seasonName < season.name`; a `null` `endsOn` means "not finished", so hand-added
  subscriptions on undated seasons are never pruned.
- **Dates are Melbourne calendar dates.** The crawl runs on GitHub Actions (UTC), so
  deriving "today" from a UTC clock can be a day behind Melbourne. A small domain module
  (`packages/domain/src/calendarDate.ts`) provides today-in-Melbourne and ISO date helpers
  via `Intl` — the same approach as `apps/scheduler/src/crawlWindow.ts`, so no new library.

## Todo

- [x] Schema + migration: `starts_on` / `ends_on` on `season` (nullable `date`), with the
      drizzle meta snapshot and journal entry.
- [x] Domain: extend `seasonSchema`; add `todayInMelbourne()` + ISO date parsing/validation.
- [x] DB: `setSeasonDatesByName`; `listLeaguesByClubId` already returns the joined `season`.
- [x] `mday catalog`: warn when an upserted season has no dates.
- [x] `mday season set-dates` (job + service + CLI wiring).
- [x] `mday season list` with `--json` (job + CLI wiring).
- [x] `sync-subscriptions`: per-club season resolution + date-based removals.
- [x] `list-subscriptions`: drop the global season default; keep `--season` exact.
- [x] Tests: season date helpers, `setSeasonDates` service, sync removals by date, and
      overlapping seasons from two sources.
- [x] Quality gates: `vp check`, `vp test`, `vp build`.
- [ ] **Prod write (needs approval):** `mday season set-dates 2026 --starts ... --ends ...`
      for the existing Dribl `2026` season.

## Open questions

- Should `mday catalog` warn once per created season, or once per run with a count?
- Does `sync-subscriptions` need an "everything finished" guard, or is per-club removal enough?
- **Does crawl scope belong to the client at all?** Tracked in #208 (crawl scope is
  system-wide, not per-client). The synthetic source has no client, so a client-keyed scope
  can't crawl it without inventing one. If scope moves to system-level targets, this PR's
  `sync-subscriptions` surface is deleted rather than refined. Land this fix as the safety net
  first; decide the model next.
- Which exact dates for Dribl's `2026` season? **Answered:** first fixture 2026-02-12, last
  2026-09-20 (Melbourne). Blocked on the migration deploying — `mday season set-dates` can't
  write until CI applies migration `0015` on merge to `main`.
