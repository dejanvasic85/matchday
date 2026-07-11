# 0003. Scraping cadence

- Status: decided
- Date: 2026-07-12

## Context

Fixtures, results, and ladder tables change at different rates. Schedules are set well ahead
and rarely move; results and ladders only change when matches are played (mostly weekends in
season). Over-scraping wastes resources and load on Dribl; under-scraping means stale scores.

## Options

- **Single fixed interval for everything** — simple, but either too frequent for schedules
  or too slow for live results.
- **Per-job cadences (recommended)** — separate jobs for club-directory vs competition data;
  competition crawl varies by season phase / match window.
- **On-demand / webhook** — Dribl offers no webhooks, so not viable.

Trigger for the frequent (match-window) cadence:
- **Fixture-derived (recommended)** — upcoming fixture dates/times decide when to run often;
  self-adjusting, handles midweek games and any timezone.
- **Static weekend windows** — simplest cron, but assumes fixed match days.

## Recommendation

**Two scheduled jobs, each on its own cadence.**

### 1. Clubs sync (independent)

A full club-directory crawl (`list/clubs`) — needed even when targeting one club, because its
teams play opponents whose club info (name, logo, socials, address) we must have. Not tied to
any competition. **Runs daily** (matches current behaviour).

### 2. Competition crawl (fixtures + results + ladders in one pass)

Competition-keyed (per 0002); a single crawl pass fetches fixtures, results, and ladder tables
together — one Cloudflare-bypass session per run. Runs at **two frequencies**:

| Phase                         | Cadence          |
| ----------------------------- | ---------------- |
| Match window (fixtures due)   | every 30 min     |
| Otherwise, in season          | daily            |
| Off-season                    | weekly           |

**Match-window triggering is derived from fixture data**, not hard-coded weekend windows: the
scheduler inspects upcoming fixture dates/times and runs the frequent cadence around them,
falling back to daily otherwise. This self-adjusts to midweek games and any competition/timezone
with no manual config.

## Consequences

- Two jobs: `clubs-sync` (daily) and `competition-crawl` (fixture-derived frequency).
- Fixtures/results/ladders share one crawl pass — fewer Cloudflare-bypass sessions.
- Scheduler reads fixture data to decide match windows — depends on having fixtures already
  scraped (bootstrap: run daily until first fixtures land, then match-window logic engages).
- Frequent match-day scraping needs the scraper runtime to handle Cloudflare bypass reliably
  at cadence (see 0009 hosting).
- 30-min match-window interval chosen for amateur fixtures where results post after full time,
  not live; revisit if faster freshness is needed.
