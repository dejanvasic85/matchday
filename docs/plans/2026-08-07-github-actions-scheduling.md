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

- **catalog** + **club-enrichment**: one scheduled workflow, each as its own job (source-wide, no
  matrix) — weekly/monthly and daily respectively (ADR 0003).
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
- Secrets: `DATABASE_URL`, `DRIBL_TENANT_SLUG`, `DRIBL_SITE_URL`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_ASSETS_URL`,
  `R2_RAW_BUCKET_NAME` (full `CliConfig` per `apps/cli/src/config.ts`) as GitHub Actions
  **environment** secrets (mirroring `deploy.yml`'s `environment: production` + `secrets.
DATABASE_URL` pattern), not repo-wide — these are prod credentials the crawl writes with.
- Update ADR 0009's Scraper/Scheduling rows to record GitHub Actions as the decision, superseding
  thanos primary + managed-browser fallback.

## Todo (sliced)

1. **catalog + club-enrichment workflow** — `.github/workflows/crawl-catalog.yml`: two scheduled
   jobs (no matrix), `voidzero-dev/setup-vp@v1` + `vp install`, Chrome install/cache, `mday
catalog` (weekly cron) and `mday club-enrichment` (daily cron) each as their own job, prod
   environment secrets wired. Validates the whole real-Chrome-on-hosted-runner path end to end
   before the harder matrix workflow. Confirm headless clears Cloudflare here first.
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
- Whether `club-enrichment` and `catalog` should also move onto their own fixture-adjacent timing,
  or stay flat weekly/daily per ADR 0003 as scoped here — current read is they stay flat (ADR 0003
  only calls out competition crawl for fixture-derived cadence).
