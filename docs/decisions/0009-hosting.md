# 0009. Hosting

- Status: decided
- Date: 2026-07-12

## Context

Available accounts: **AWS** (pay-as-you-go), **Cloudflare** (free PAYG, and the user is
consolidating most services here), **Vercel** ($20/mo), plus **thanos** — a self-hosted
Unraid box at home. The system has parts with very different needs:

1. **Scraper** — needs **real Chrome** to bypass Dribl's Cloudflare, runs on a schedule
   (0003). Not a fit for short-lived pure-serverless functions.
2. **Database** — Postgres (0006).
3. **API** — read-mostly REST (0007) on Cloudflare Workers + Hono, edge-cached.
4. **Logos** — self-hosted on Cloudflare R2 (0004).

Self-hosting Postgres on thanos was ruled out: exposing it to a cloud API was already tried
and proved painful (tunnel/DDNS/firewall), and it would drag the API onto thanos too. The
existing **Neon** free project is barely used (~0.07 GB, ~1 CU-hr/mo) — this dataset is tiny
(tens of MB even association-wide) — and Neon pairs cleanly with Workers via its serverless
driver / Hyperdrive.

## Decision: best-of-breed, decided per component

No single-provider mandate. Each component is hosted wherever it fits best, and **mixing
free / third-party services (including external cron) is explicitly fine**. All components,
including the scraper runtime and its scheduling, are settled.

| Component    | Choice                                                               | Status             |
| ------------ | -------------------------------------------------------------------- | ------------------ |
| Logos/assets | **Cloudflare R2** (per 0004)                                         | settled            |
| Edge / CDN   | **Cloudflare** (cache, TLS)                                          | settled            |
| API (REST)   | **Cloudflare Workers + Hono** (per 0007)                             | settled            |
| Database     | **Neon** (existing free project); Postgres per 0006                  | settled            |
| Scraper      | **GitHub Actions** (hosted runners, real Chrome via playwright-core) | settled, see below |
| Scheduling   | **GitHub Actions** scheduled workflows, per job                      | settled, see below |

## Scraper runtime (the awkward part) — superseded

The original direction below (thanos primary, managed-browser fallback) was **superseded by
GitHub Actions** (issue #65): hosted runners install real Chrome
(`playwright install --with-deps chrome`) and run the crawler directly, no residential-IP or
home-internet-availability risk, and GitHub Actions minutes are free for this public repo. The
`williamstownsc` repo already proved the same shape (scheduled + matrix workflow). Kept here for
history:

- **Primary: thanos (Unraid).** Run the crawler as a Docker container, scheduled via Unraid
  User Scripts or a scheduled container. Cheap, full control over the browser and
  bypass tuning, hardware already owned.
- **Risk:** thanos uses a **residential IP** that Cloudflare/Dribl could rate-limit or block;
  and if thanos is offline, crawls stop.
- **Mitigation / fallback: a managed browser service** (Browserless / Cloudflare Browser
  Rendering / Browserbase). The crawler (playwright-core) connects to a browser **endpoint**,
  so switching from local Chromium to a remote browser is a config/URL change, not a rewrite.
  Fall back (or overflow) to the managed service if the IP is blocked or thanos is down.

The browser connection stayed abstracted behind one interface regardless, so this was a config
change, not a rewrite, when GitHub Actions was adopted.

## Scheduling

Per job (0003 defines the job shapes), all on **GitHub Actions scheduled workflows** (`on.schedule`
cron), one workflow per job group: catalog + club-enrichment (`crawl-catalog.yml`, weekly/on
club-enrichment's own cadence) and deep-crawl (`crawl-deep.yml`, hourly during plausible game
windows — weekday evenings and weekend daytime/evening AEST). Fixture-derived cadence (skip a
league entirely off game day, per 0003) was considered and **decided against for now** — the
hourly game-window schedule plus per-league deep-crawl cost (~3-4 min) was judged a good enough
compromise without the added complexity of querying fixture state to build the cron windows.

## Consequences

- Mostly Cloudflare (Workers API + R2 + edge) with Neon for Postgres and GitHub Actions for
  scraping — few bills, edge-native, no self-hosted DB exposure, no home-server dependency.
- R2 + Cloudflare edge give edge-native asset and API caching aligned to scrape cadence (0003).
- Worker → Neon via serverless driver / Hyperdrive (no raw TCP from a V8 isolate).
- Scraper still abstracts its browser endpoint (playwright-core connects to an endpoint), so a
  future move off GitHub Actions hosted runners remains a config change, not a rewrite.
- Secrets/env managed per environment (GitHub Actions repo/environment secrets for the scraper);
  infra captured in the monorepo `infra/` (per 0010).
