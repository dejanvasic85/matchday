# @matchday/scraper

The Dribl crawler and its jobs, exposed as the **`mday`** CLI. It clears Dribl's Cloudflare with a
real Chrome via playwright-core, then calls `mc-api.dribl.com` directly, staging raw responses to R2
before transforming and upserting to Postgres (Neon). See the `dribl-crawling` skill and ADRs
[0004](../../docs/decisions/0004-scraping-depth.md), [0009](../../docs/decisions/0009-hosting.md),
[0012](../../docs/decisions/0012-entity-resolution.md).

## Jobs

| Command      | What it does                                                                     |
| ------------ | -------------------------------------------------------------------------------- |
| `mday clubs` | Full `list/clubs` crawl → upsert the Dribl club record (enrichment). See [0012]. |

More jobs (competition crawl, scheduling) land per [docs/todo.md](../../docs/todo.md) Phase 3.

## Running locally

Local dev targets the Neon **`matchday-dev`** database and real Cloudflare R2 — the scraper stages
raw responses to R2 on the critical path, so R2 is required, not optional.

### 1. Prerequisites

- **Google Chrome installed** — playwright-core drives your real Chrome (`channel: "chrome"`) to
  clear Cloudflare. Leave `BROWSER_WS_ENDPOINT` unset to launch it locally (thanos-primary mode).
- **Neon `matchday-dev`** connection string (pooled host, `?sslmode=require`).
- **Cloudflare R2**: two buckets and an API token (see below).

### 2. Cloudflare R2 buckets

Create both buckets in your Cloudflare account and an R2 API token with read/write to them:

- **`matchday-raw`** — raw Dribl API responses, staged pre-transform. Add a **7-day lifecycle
  expiry rule** (ADR 0004) so staged objects self-delete.
- **`matchday-logos`** — club logos (used by the competition crawl; not written by `mday clubs`
  yet, but the config requires the name).

### 3. Environment

Copy the example and fill it in — it is loaded automatically by the `mday` script:

```sh
cp apps/scraper/.env.example apps/scraper/.env.local
```

`.env.local` is gitignored. All vars are documented in `.env.example` and validated by
`src/config.ts` (Zod) at startup — a missing/invalid var fails fast with a clear message.

### 4. Run

From the repo root:

```sh
vp run --filter @matchday/scraper mday clubs
```

or from `apps/scraper`:

```sh
vp run mday clubs
```

The `mday` script runs `node --env-file-if-exists=.env.local ./src/index.ts`, so `.env.local` is
picked up with no dotenv dependency. `mday --help` (or `mday clubs --help`) lists commands.

Logs are JSON lines: `info`/`debug` on stdout, `warn`/`error` on stderr (so Cloudflare Workers Logs
classifies them in production). Control verbosity with `LOG_LEVEL` (`debug|info|warn|error`).

## Tests & checks

```sh
vp check          # lint + format + type-check
vp test           # unit tests (DI fakes; no live browser/DB/R2)
```

Services (`jobs/`, `crawler/` resolvers) are pure and dependency-injected, unit-tested with
hand-built fakes — the CLI (`cli.ts`) is thin transport glue that wires the real collaborators.
