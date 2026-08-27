# 0004. Scraping depth

- Status: decided
- Date: 2026-07-12

## Context

The current pipeline captures enough to render fixtures, results and tables: a fixture's date,
time, round, venue and coordinates, both teams, the scores and the status, plus club details
(logo, name, socials, address) and full table rows. It captures no player-level match stats.

For a shared service we want to be self-sufficient — able to answer a query without going back
to Dribl — without collecting data nobody uses yet.

## Options

- **Keep the current depth, but promote to first-class entities (recommended)** — the same
  fields, except competition, season and league become real entities instead of name strings.
- **Minimal** — scores and fixtures only. Drops venue, coordinates and club branding, and forces
  extra lookups.
- **Maximal**, adding player stats, lineups and events — the richest option, but Dribl covers
  these inconsistently and v1 does not need them.

## Recommendation

**Self-sufficient, current depth + first-class competition entities.** Capture:

- **Fixture**: date, time, round, venue, coordinates, status, home/away scores, bye flag.
- **Club**: name, display name, logo, email, website, address, socials.
- **Team**: name, competition membership.
- **Competition/Season/League**: as entities with IDs (not just names).
- **Table entry**: full rows — position, played, won, drawn, lost, goals for, goals against, goal
  difference, and points.

A later ADR can add player-level match stats.

### Images / logos

**Self-host the logos** instead of hotlinking Dribl (`ocean.dribl.com`). As we scrape, download
each logo into our own **Cloudflare R2** bucket. R2 is S3-compatible, charges no egress fees, and
pairs with the Cloudflare edge we chose in 0009. The entity then stores our own asset URL, and
the `external_ref` record keeps the original Dribl URL so we can re-fetch. Key object names on a
content hash or an entity id, so a re-upload only writes when the logo actually changed.

### Raw response staging

The WSC crawler runs in two stages. First it writes each raw Dribl API response — fixtures and
results paged per round, plus `api/ladders` — to local JSON chunk files. Then a separate sync
stage reads those chunks, transforms them, removes duplicates and writes the final output.

matchday keeps that two-stage shape, but writes the raw capture to **Cloudflare R2** rather than
local disk, in the same bucket family we already use for logos. We do that because the crawl and
transform steps share no durable filesystem on the runtime we target in 0009.

- **Why keep a raw stage.** We can reprocess a bad mapper without crawling again, which would
  cost another Cloudflare-bypass session. It also gives us a concrete artifact to diagnose crawl
  failures and Dribl response changes against.
- **Storage.** R2, one object per API response, keyed roughly as
  `raw/{tracked_competition_id}/{crawl_run_id}/{endpoint}-{round}.json`. That mirrors WSC's
  per-round chunking, in R2 rather than `data/external/`.
- **Lifecycle.** A bucket lifecycle rule expires objects after **7 days** — long enough to
  diagnose a bad crawl or re-run a transform, and cheap enough that nobody has to manage it.
- **The pipeline has three steps, not two.** Crawl writes raw responses to R2. Transform reads
  them back and maps them to the domain through the Zod mappers. Upsert writes to Postgres
  through `external_ref`, per 0006. Crawl and transform can share one job invocation at first,
  since we need no async boundary yet. The raw artifact lands in R2 either way, so splitting them
  later is a scheduling change rather than a rewrite.

## Consequences

- The schema models competition, season and league explicitly, which enables 0006's relational
  joins.
- Transforming takes slightly more work than today's flat records.
- We can add player stats later without reworking the core entities.
- The scraper gains a step that mirrors images to Cloudflare R2, so 0009 must include R2.
- Serving club branding no longer depends on Dribl's CDN staying up.
- The scraper also writes raw API responses to R2 before transforming, expiring after 7 days.
  That adds an R2 write path to the crawler beyond logos, and a read path to the transform step.
