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
3. **API** — read-mostly REST (0007), fronted by Cloudflare for edge caching.
4. **Logos** — self-hosted on Cloudflare R2 (0004).

## Decision: best-of-breed, decided per component

No single-provider mandate. Each component is hosted wherever it fits best, and **mixing
free / third-party services (including external cron) is explicitly fine**. Some components
are settled now; two (database, scraper runtime) carry a clear primary direction plus a
fallback and can be firmed up during build.

| Component     | Choice                                | Status                    |
| ------------- | ------------------------------------- | ------------------------- |
| Logos/assets  | **Cloudflare R2** (per 0004)          | settled                   |
| Edge / CDN    | **Cloudflare** (cache, TLS)           | settled                   |
| API (REST)    | **Vercel** ($20 plan); CF Workers alt | settled (primary Vercel)  |
| Database      | **Managed Postgres** — Supabase lead; Neon / Vercel PG alts | direction set, confirm at build |
| Scraper       | **thanos (self-hosted Unraid)** primary; managed browser service fallback | direction set, see below |
| Scheduling    | Flexible — Vercel Cron / GitHub Actions / EventBridge / thanos cron; combine free tiers | open, per job |

## Scraper runtime (the awkward part)

The scraper's real-Chrome + Cloudflare-bypass requirement rules out pure serverless.

- **Primary: thanos (Unraid).** Run the crawler as a Docker container, scheduled via Unraid
  User Scripts or a scheduled container. Cheap, full control over the browser and
  bypass tuning, hardware already owned.
- **Risk:** thanos uses a **residential IP** that Cloudflare/Dribl could rate-limit or block;
  and if thanos is offline, crawls stop.
- **Mitigation / fallback: a managed browser service** (Browserless / Cloudflare Browser
  Rendering / Browserbase). The crawler (playwright-core) connects to a browser **endpoint**,
  so switching from local Chromium to a remote browser is a config/URL change, not a rewrite.
  Fall back (or overflow) to the managed service if the IP is blocked or thanos is down.

Keep the crawler's browser connection abstracted behind one interface so primary↔fallback is
a swap.

## Scheduling

Per-job (0003 defines two jobs). Any cheap/free trigger is acceptable and they can differ per
job: thanos cron, GitHub Actions scheduled workflow, Vercel Cron, or AWS EventBridge. Decide
per job when built; no lock-in.

## Consequences

- Multiple providers, each doing what it's best at, within existing/owned resources.
- R2 + Cloudflare edge give edge-native asset and API caching aligned to scrape cadence (0003).
- Scraper abstracts its browser endpoint → thanos primary, managed service as drop-in fallback.
- Two sub-choices (DB provider, final scraper host) intentionally left to confirm at build;
  the direction and fallbacks are recorded so no rearchitecture is needed either way.
- Secrets/env managed per environment; infra captured in the monorepo `infra/` (per 0010).
