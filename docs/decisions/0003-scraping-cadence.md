# 0003. Scraping cadence

- Status: decided
- Date: 2026-07-12
- Reshaped by: [0009](0009-hosting.md) — the crawl runs on GitHub Actions scheduled workflows.
  We considered the fixture-derived match window below and **decided against it for now**, in
  favour of a fixed hourly schedule across plausible game windows.
- Reshaped by: [0012](0012-subscription-multisource.md) — the jobs are now a source-wide catalog
  crawl and a subscription-driven deep crawl. Club enrichment replaced the standalone
  `clubs-sync` job, and subscriptions replaced the tracked-competition registry.

## Context

Fixtures, results and tables change at different rates. Clubs set schedules well ahead and rarely
move them. Results and tables change only when teams play, which in season mostly means weekends.
Scraping too often wastes our resources and loads Dribl for nothing; scraping too rarely leaves
stale scores on the site.

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

A full club-directory crawl (`list/clubs`). We need it even when we target a single club, because
that club's teams play opponents whose name, logo, socials and address we must also hold. It is
tied to no competition. **Runs daily**, which matches what we do today.

### 2. Competition crawl (fixtures + results + tables in one pass)

Keyed on competition, per 0002. One crawl pass fetches fixtures, results and tables together, so
each run needs only one Cloudflare-bypass session. It runs at **two frequencies**:

| Phase                       | Cadence      |
| --------------------------- | ------------ |
| Match window (fixtures due) | every 30 min |
| Otherwise, in season        | daily        |
| Off-season                  | weekly       |

**Fixture data decides the match window**, not hard-coded weekend windows. The scheduler reads
upcoming fixture dates and times, runs the frequent cadence around them, and falls back to daily
otherwise. That adjusts itself to midweek games and to any competition or timezone, with no
manual config.

## Consequences

- Two jobs: `clubs-sync` daily, and `competition-crawl` at a fixture-derived frequency.
- Fixtures, results and tables share one crawl pass, so we open fewer Cloudflare-bypass sessions.
- The scheduler reads fixture data to find match windows, so it needs fixtures already scraped.
  To bootstrap, run daily until the first fixtures land, then the match-window logic takes over.
- Frequent match-day scraping needs a runtime that clears Cloudflare reliably at that cadence.
  See 0009.
- We chose a 30-minute match window because these are amateur fixtures, where results post after
  full time rather than live. Revisit it if we need fresher scores.
