# 0009. Hosting

- Status: proposed
- Date: 2026-07-12

## Context

Available accounts: **AWS** (pay-as-you-go), **Cloudflare** (free PAYG), **Vercel** ($20/mo).
The system has three parts with different needs:

1. **Scraper** — needs **real Chrome** to bypass Dribl's Cloudflare, runs on a schedule
   (0003). Not a fit for short-lived pure-serverless functions.
2. **Database** — Postgres (0006).
3. **API** — read-mostly REST (0007), fronted by Cloudflare for edge caching.

## Options / mapping

- **Database**:
  - **Supabase Postgres** (recommended start) — managed Postgres, generous free/low tier,
    good DX; or
  - **Vercel Postgres** — tight Vercel integration; or
  - **AWS RDS/Aurora Serverless** — most control, more ops.
- **Scraper runtime** (needs a browser + cron):
  - **AWS** scheduled container (ECS/Fargate task or a scheduled EC2/Lambda-container with
    Chromium) driven by EventBridge — recommended, matches PAYG and long-running browser work.
  - A self-hosted runner as a cheaper alternative.
- **API**:
  - **Vercel** (recommended) — hosts the REST API; uses the existing $20 plan.
- **Edge/CDN**:
  - **Cloudflare** in front of the API for caching, TLS, and rate limiting — recommended
    (free PAYG).
- **Static assets** (logos, etc.): **Cloudflare R2** to self-host images (per 0004) —
  S3-compatible, no egress fees, pairs with the Cloudflare edge; user is consolidating on
  Cloudflare. AWS S3 is the fallback alternative.

## Recommendation

- **DB**: start on **Supabase Postgres** (revisit Vercel Postgres if integration wins out).
- **Scraper**: **AWS scheduled container** (EventBridge → Fargate task with Chromium).
- **API**: **Vercel**.
- **Edge**: **Cloudflare** in front of the API.

## Consequences

- Three providers, each doing what it's best at within existing accounts.
- Scraper's Cloudflare-bypass requirement rules out pure serverless — needs a container.
- Cache TTLs at Cloudflare aligned with scrape cadence (0003).
- Secrets/env managed per environment; infra captured in the monorepo `infra/`.
