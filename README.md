# matchday

A multi-tenant sports competition data service — scrapes fixtures, results and
tables, and serves them via an API so multiple clubs can consume the same data.

This monorepo will contain the CLI crawler, the API, and supporting infrastructure.

## Status

Early planning. Direction is being locked through architecture decision records before any
service code is written.

- Decisions: [docs/decisions](docs/decisions/README.md) — all 10 locked (0001–0010).
- Build backlog: [GitHub Issues](https://github.com/dejanvasic85/matchday/issues) — grouped by
  phase milestones, labelled with the ADR each item implements.

## Background

Extracted from the `williamstownsc` project, where fixtures/results/tables were captured as
flat JSON files on disk and read directly by a single Next.js app. That worked for one club
but doesn't scale to onboarding others — hence a standalone, API-served service.

## Local development

### Running the `mday` CLI

`mday` is the crawler CLI ([apps/cli](apps/cli/src/cli.ts)). It drives a real Chrome via
playwright-core to clear Dribl's Cloudflare, then makes direct `mc-api.dribl.com` calls. Where it
runs in production is still outstanding — for now it's a local-only tool.

> **Note:** deploying the crawler to production is not yet solved. These instructions cover local
> runs only.

**1. Configure the environment.** The CLI loads [apps/cli/.env.local](apps/cli/.env.example)
automatically (gitignored). Copy the example and fill it in:

```sh
cp apps/cli/.env.example apps/cli/.env.local
```

Point `DATABASE_URL` at the Neon **`matchday-dev`** pooled host (`?sslmode=require`) — never prod.
See [apps/cli/.env.example](apps/cli/.env.example) for every variable; R2 credentials are
required (raw responses are staged there even on a dry run).

**2. Run a command.** From the repo root, `pnpm mday <command>` forwards straight to the CLI (args
pass through unchanged):

```sh
pnpm mday --help
```

Both crawl commands support `--dry-run`, which crawls and stages raw responses to R2 but skips all
database upserts.

### `catalog` — cheap, source-wide

Crawls every competition, league and team (with clubs) for a source + season and upserts the
catalog used by onboarding dropdowns. Run this first: it populates the `league` rows (and their
`lea_` ids) that a deep crawl targets.

```sh
# Catalog the current season (writes to the DB)
pnpm mday catalog

# A specific season, capped, without writing
pnpm mday catalog --season 2025 --max-leagues 5 --dry-run
```

### `deep-crawl` — expensive, one league

Crawls fixtures + the table for **exactly one league**, discovering clubs/teams and persisting them
via entity resolution. It takes an internal `lea_`-prefixed league id (not a Dribl id):

```sh
pnpm mday deep-crawl --league lea_xxxxxxxxxxxx

# Stage raw + log a summary without writing to the DB
pnpm mday deep-crawl --league lea_xxxxxxxxxxxx --dry-run
```

To find a `lea_` id, run `catalog` (above) to populate the leagues, then look one up by name in the
dev database, e.g.:

```sql
select id, name from league order by name;
```
