# 0004. Scraping depth

- Status: decided
- Date: 2026-07-12

## Context

The current pipeline captures enough to render fixtures, results, and tables: fixture
date/time/round/venue/coordinates, both teams, scores, status, plus club metadata (logo,
name, socials, address) and full table rows. It does not capture player-level match stats.
For a shared service we want to be self-sufficient (not re-fetch Dribl to answer a query)
without over-collecting data no one uses yet.

## Options

- **Match current depth, promoted to first-class entities (recommended)** — same fields,
  but competition/season/league become real entities rather than name strings.
- **Minimal** — only scores + fixtures. Loses venue, coordinates, club branding; forces
  extra lookups.
- **Maximal (incl. player stats, lineups, events)** — richest, but Dribl coverage is
  inconsistent and it's out of scope for v1 features.

## Recommendation

**Self-sufficient, current depth + first-class competition entities.** Capture:

- **Fixture**: date, time, round, venue, coordinates, status, home/away scores, bye flag.
- **Club**: name, display name, logo, email, website, address, socials.
- **Team**: name, age group, gender, competition membership.
- **Competition/Season/League**: as entities with IDs (not just names).
- **Table entry**: full rows (position, played, W/D/L, GF/GA/GD, points).

Defer player-level match stats to a later ADR.

### Images / logos

**Self-host logos** rather than hotlinking Dribl (`ocean.dribl.com`). On scrape, download
each logo and store it in our own bucket — **Cloudflare R2** (S3-compatible, no egress fees,
pairs with the Cloudflare edge in 0009). The entity stores our own asset URL; the original
Dribl URL is retained on the `external_ref`/source record for re-fetch. Content-hash or
entity-id keyed object names to allow idempotent re-upload only on change.

### Raw response staging

The current WSC crawler is two-stage: it writes each raw Dribl API response (fixtures/results
paged per round, `api/ladders`) to local JSON chunk files, then a separate sync stage reads those
chunks, transforms, dedupes, and writes final output. matchday keeps that two-stage shape, but
since the target runtime (thanos/managed browser, per 0009) has no durable shared filesystem
between the crawl and transform steps, the raw capture is persisted to **Cloudflare R2**
instead of local disk — the same bucket family already used for logos.

- **Why keep a raw stage:** lets a bad transform/mapper be reprocessed without re-crawling
  (another Cloudflare-bypass session); gives a concrete artifact to diagnose Dribl response
  changes or crawl failures against.
- **Storage:** R2, one object per API response, keyed by something like
  `raw/{tracked_competition_id}/{crawl_run_id}/{endpoint}-{round}.json` (mirrors WSC's
  per-round chunking, just in R2 instead of `data/external/`).
- **Lifecycle:** bucket lifecycle rule, **7-day expiry** — enough runway to diagnose a bad
  crawl or re-run a transform, cheap enough not to manage manually.
- **Pipeline is three steps, not two:** crawl (writes raw responses to R2) → transform (reads
  raw from R2, maps to domain via the Zod mappers in `packages/domain`) → upsert (writes to
  Postgres via `external_ref`, per 0006). Crawl and transform can run in the same job
  invocation to start — no need to force an async boundary yet — but the raw artifact still
  lands in R2 either way, so splitting them later is a scheduling change, not a rewrite.

## Consequences

- Schema models competition/season/league explicitly — enables 0006's relational joins.
- Slightly more transform work than today's flat records.
- Player stats can be added later without reworking core entities.
- Scraper gains an image-mirroring step to Cloudflare R2; adds R2 to the infra in 0009.
- Independent of Dribl CDN uptime for serving branding.
- Scraper also writes raw API responses to R2 before transforming, with a 7-day expiry —
  adds an R2 write path (beyond logos) to the crawler, and a read path to the transform step.
