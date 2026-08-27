# 0009. Hosting

- Status: decided
- Date: 2026-07-12

## Context

We have accounts on **AWS** (pay as you go), **Cloudflare** (free, pay as you go, and where we
are consolidating most services), and **Vercel** ($20/month). We also have **thanos**, a
self-hosted Unraid box at home. The system's parts have very different needs:

1. **Scraper** — needs **real Chrome** to get past Dribl's Cloudflare, and runs on a schedule
   (0003). Short-lived serverless functions do not suit it.
2. **Database** — Postgres (0006).
3. **API** — read-mostly REST (0007) on Cloudflare Workers and Hono, cached at the edge.
4. **Logos** — self-hosted on Cloudflare R2 (0004).

We ruled out self-hosting Postgres on thanos. We had already tried exposing it to a cloud API,
and the tunnel, dynamic DNS and firewall work proved painful. It would also drag the API onto
thanos. Meanwhile our existing free **Neon** project sits almost idle at roughly 0.07 GB and one
compute-unit-hour a month, because this dataset is tiny — tens of megabytes even across a whole
association. Neon also pairs cleanly with Workers through its serverless driver or Hyperdrive.

## Decision: best-of-breed, decided per component

We mandate no single provider. Each component runs wherever it fits best, and **mixing free and
third-party services, including an external cron, is explicitly fine**. Every component is now
settled, including the scraper runtime and its scheduling.

| Component    | Choice                                                               | Status             |
| ------------ | -------------------------------------------------------------------- | ------------------ |
| Logos/assets | **Cloudflare R2** (per 0004)                                         | settled            |
| Edge / CDN   | **Cloudflare** (cache, TLS)                                          | settled            |
| API (REST)   | **Cloudflare Workers + Hono** (per 0007)                             | settled            |
| Database     | **Neon** (existing free project); Postgres per 0006                  | settled            |
| Scraper      | **GitHub Actions** (hosted runners, real Chrome via playwright-core) | settled, see below |
| Scheduling   | **GitHub Actions** scheduled workflows, per job                      | settled, see below |

## Scraper runtime (the awkward part) — superseded

**GitHub Actions superseded the original direction below**, which made thanos primary with a
managed browser as fallback (issue #65). Hosted runners install real Chrome with
`playwright install --with-deps chrome` and run the crawler directly. That removes both the
residential-IP risk and the dependency on our home internet staying up, and GitHub Actions
minutes cost nothing for a public repo. The `williamstownsc` repo had already proved the same
shape, using a scheduled matrix workflow.

We keep the original direction here for history:

- **Primary: thanos (Unraid).** Run the crawler as a Docker container, scheduled through Unraid
  User Scripts or a scheduled container. Cheap, gives full control over the browser and
  bypass tuning, and runs on hardware we already own.
- **Risk:** thanos uses a **residential IP address**, which Cloudflare or Dribl could rate-limit
  or block. If thanos goes offline, crawling stops.
- **Fallback: a managed browser service**, such as Browserless, Cloudflare Browser Rendering or
  Browserbase. playwright-core connects to a browser **endpoint**, so moving from local Chromium
  to a remote browser changes a URL, not the code. We fall back to the managed service if
  something blocks our IP address or thanos goes down, and can overflow onto it when thanos
  cannot keep up.

We kept the browser connection behind one interface throughout. That is why adopting GitHub
Actions cost us a config change rather than a rewrite.

## Scheduling

Every job runs on a **GitHub Actions scheduled workflow** (`on.schedule` cron). 0003 defines the
job shapes.

- **Catalog and club enrichment** run weekly on one cron, sequenced inside a single workflow:
  `crawl-catalog.yml`, where club enrichment declares `needs: catalog`.
- **Deep crawl** runs on its own workflow, `crawl-deep.yml`, hourly through the hours when games
  plausibly happen — weekday evenings, and weekend daytime and evening, Australian Eastern time.

We considered the fixture-derived cadence from 0003, which would skip a league entirely when it
has no game that day, and **decided against it for now**. An hourly game-window schedule costs
roughly 3 to 4 minutes per league, which we judged a good enough compromise. Querying fixture
state to build the cron windows would add more complexity than that saves.

## Consequences

- We run mostly on Cloudflare — Workers for the API, plus R2 and the edge — with Neon for
  Postgres and GitHub Actions for scraping. That means few bills, an edge-native stack, no
  self-hosted database exposed to the internet, and no dependency on a home server.
- R2 and the Cloudflare edge cache both assets and API responses close to consumers, aligned to
  the scrape cadence in 0003.
- The Worker reaches Neon through the serverless driver or Hyperdrive, never raw TCP from a V8
  isolate.
- The scraper still connects to a browser endpoint rather than a fixed browser, so moving off
  GitHub Actions hosted runners later stays a config change, not a rewrite.
- We manage secrets per environment, using GitHub Actions repository and environment secrets for
  the scraper. Infrastructure config lives in the monorepo's `infra/` directory, per 0010.
