# 0003. Scraping cadence

- Status: proposed
- Date: 2026-07-12

## Context

Fixtures, results, and ladder tables change at different rates. Schedules are set well ahead
and rarely move; results and ladders only change when matches are played (mostly weekends in
season). Over-scraping wastes resources and load on Dribl; under-scraping means stale scores.

## Options

- **Single fixed interval for everything** — simple, but either too frequent for schedules
  or too slow for live results.
- **Tiered, data-type-aware schedule (recommended)** — different cadences per data type and
  per season phase.
- **On-demand / webhook** — Dribl offers no webhooks, so not viable.

## Recommendation

**Tiered cron schedule per competition:**

| Data          | Match days (Sat/Sun, in season) | Weekdays (in season) | Off-season |
| ------------- | ------------------------------- | -------------------- | ---------- |
| Fixtures/schedule | daily                       | daily                | weekly     |
| Results       | every 15–30 min                 | daily                | weekly     |
| Ladder tables | every 15–30 min                 | daily                | weekly     |

Match-day windows can be bounded to typical fixture hours to avoid overnight polling.

## Consequences

- Scheduler must be config-driven (per competition, per season phase).
- Need a notion of "in season" and "match day" per competition.
- Frequent match-day scraping requires the scraper runtime to handle Cloudflare bypass
  reliably at cadence (see 0009 hosting).
