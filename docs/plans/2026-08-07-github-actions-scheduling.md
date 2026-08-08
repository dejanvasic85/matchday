# GitHub Actions scheduling (supersedes thanos primary)

## Purpose

Implement #65: run and schedule the three `mday` jobs (catalog, club-enrichment, deep-crawl) on
**GitHub Actions** instead of self-hosted thanos, per the ADR 0009 pivot. Reuses the proven shape
from `williamstownsc`'s `.github/workflows/crawl.yml` (setup job computes a matrix, matrix jobs
install real Chrome and crawl in parallel) rather than building a home-server deploy path. Closes
#51 (cron mechanism decision) and implements #43 (per-job triggers driven by the subscription
set) via this mechanism. Companion PR already removed the Docker/GHCR pipeline
(`chore/remove-docker-cli-pipeline`, merged to `main`).

matchday differs from `williamstownsc` in one important way: crawl output is **persisted directly
to Neon Postgres by the CLI job itself** (`mday catalog` / `mday deep-crawl` / `mday
club-enrichment` already upsert via `packages/db`), so there is no `williamstownsc`-style
artifact-upload → download → commit-PR chain — each matrix job just runs the CLI with real
secrets and exits.

## Requirements

- **catalog** + **club-enrichment**: one scheduled workflow, weekly, source-wide (no matrix).
  `club-enrichment` **depends on `catalog`** (`needs: catalog`) — catalog's table pass discovers/
  upserts clubs too (`catalogPersistence.ts` → `resolveTableEntryEntities`), so enrichment has
  nothing to attach detail to until catalog has run. This revises ADR 0003/0012's "daily" cadence
  for the clubs job down to weekly, sequenced after catalog rather than independent.
- **deep-crawl**: a matrix workflow, one job per subscribed league id (source ids, not chunks —
  deep-crawl is already single-league per invocation), mirroring `crawl.yml`'s `setup` →
  `fromJson(needs.setup.outputs.*)` matrix pattern. The `setup` job needs a `list-subscribed-leagues
--json` style `mday` command backed by the existing `listSubscribedLeagueIds` query — none
  exists yet.
- **Fixture-derived cadence** (ADR 0003): match-window (fixtures due soon) → every 30 min;
  otherwise in-season → daily; off-season → weekly. No cadence-decision logic exists in the repo
  today — this is new: a query for "does league X have a fixture inside the next N hours" plus a
  pure service that buckets each subscribed league into `matchWindow | daily | weekly`, unit
  tested like any other service per AGENTS.md. The workflow cron itself fires every 30 min; the
  `setup` job's matrix is _which leagues_ run this invocation, filtered by bucket vs. a
  once-daily/once-weekly time-of-day gate.
- Real Chrome on the runner (`playwright install --with-deps chrome`, cached like `crawl.yml`
  does). `browserSession.ts` already defaults `headless: true` and no `BROWSER_WS_ENDPOINT` is
  set in CI, so the runner launches local headless Chrome — simplest path, no `xvfb-run` needed.
  Validate this actually clears Dribl's Cloudflare on a hosted runner before locking it in; fall
  back to headed + `xvfb-run` (matching `williamstownsc`) only if headless gets blocked.
- Secrets: `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME`, `R2_PUBLIC_ASSETS_URL`, `R2_RAW_BUCKET_NAME` as GitHub Actions **environment**
  secrets (mirroring `deploy.yml`'s `environment: production` + `secrets.DATABASE_URL` pattern),
  not repo-wide — these are prod credentials the crawl writes with. `DRIBL_TENANT_SLUG` /
  `DRIBL_SITE_URL` (the rest of `CliConfig`, per `apps/cli/src/config.ts`) aren't secret — a public
  tenant subdomain and site URL — so they're plain workflow `env:` values, not secrets.
- Update ADR 0009's Scraper/Scheduling rows to record GitHub Actions as the decision, superseding
  thanos primary + managed-browser fallback.

## Todo (sliced)

1. **catalog + club-enrichment workflow** — `.github/workflows/crawl-catalog.yml`: one weekly
   cron, `voidzero-dev/setup-vp@v1` + `vp install`, Chrome install/cache, `mday catalog` then
   `mday club-enrichment` (`needs: catalog`) as a sequential pair, prod environment secrets wired.
   Also fixed a `vp run` env-stripping gotcha found while validating this slice live: `vp run`
   sandboxes package.json **scripts** to a minimal env (`PATH`/`HOME`/`CI`/...) same as cached
   `vite.config.ts` tasks — `mday` had to move from a package.json script into a `vite.config.ts`
   task with `cache: false` (mirroring `packages/db`'s `db:migrate`) to get the full environment
   (`DATABASE_URL`, R2 creds, `DRIBL_*`) through. Validates the whole real-Chrome-on-hosted-runner
   path end to end before the harder matrix workflow. Confirm headless clears Cloudflare here
   first.
2. **deep-crawl matrix workflow, static cadence** — add a `list-subscribed-leagues` (or similar)
   `mday` command emitting a JSON array of league ids for `fromJson`; `.github/workflows/
crawl-deep.yml` with a `setup` job (installs deps, runs the list command) → matrix job per
   league running `mday deep-crawl --league <id>`; single daily cron to start (defer the 30-min
   match-window trigger to slice 3). `fail-fast: false` so one bad league doesn't cancel the rest.
3. **Fixture-derived cadence** — new `fixtureDb` query for "leagues with a fixture in the next N
   hours"; a pure `crawlCadence` service bucketing subscribed leagues into `matchWindow | daily |
weekly` (unit tested, DI'd data-access + clock per AGENTS.md); wire into the `setup` job so a
   30-min cron only emits `matchWindow` leagues on off-ticks, and `daily`/`weekly` leagues run on
   their own gated schedule within the same workflow.
4. **ADR + issue hygiene** — update ADR 0009 (Scraper + Scheduling rows → GitHub Actions,
   supersede thanos), tick #65's checklist as slices land, close #51, comment/close #43 once the
   triggers are fully wired.

## Open questions

- Headless vs. headed+`xvfb-run` — decide empirically in slice 1 against a real hosted runner; not
  a design choice to make ahead of evidence.
- Exact cron expressions for the daily/weekly gate sharing one workflow with the 30-min
  match-window tick (time-of-day check in the `setup` job vs. separate `schedule:` entries like
  `williamstownsc`'s weekday/weekend split) — resolve during slice 3.
- Whether `catalog`/`club-enrichment` should also move onto fixture-adjacent timing, or stay flat
  weekly as scoped here — current read is they stay flat (ADR 0003 only calls out the competition
  crawl for fixture-derived cadence). Resolved during slice 1: `club-enrichment`'s cadence drops
  from ADR 0003/0012's "daily" to weekly, sequenced after `catalog` (see Requirements) — needs an
  ADR 0003 update alongside the ADR 0009 update in slice 4.
