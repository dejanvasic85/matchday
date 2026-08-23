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

### Running the API

```
vp run --filter @matchday/api dev
```

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

Point `DATABASE_URL` at the Neon **`matchday`** pooled host (`?sslmode=require`).
See [apps/cli/.env.example](apps/cli/.env.example) for every variable; R2 credentials are
required (raw responses are staged there even on a dry run).

> ⚠️ **That is the production database.** There is no separate dev database — keeping a second
> crawled copy in sync cost more than it was worth. Every local command that writes is writing to
> live data, so prefer `--dry-run` while iterating, and treat `client add`, `add-subscription` and
> `create-token` as production changes. Neon branching (a copy-on-write branch of `matchday`, no
> re-crawl) is the intended way to get isolation back; it isn't set up yet.

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

# Crawl only a window of the flat league queue (crawl-catalog.yml's matrix legs use this — the
# full catalog is too large to fit one serial run in any reasonable job timeout)
pnpm mday catalog --offset 30 --limit 30

# Print how many leagues are queued, without crawling (sizes the matrix above)
pnpm mday catalog --count
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
database, e.g.:

```sql
select id, name from league order by name;
```

### `client` — onboarding an API consumer

A client is an API consumer. Its **subscriptions** decide what the deep crawl bothers to crawl, and
its **tokens** authenticate its requests. Onboarding one is four commands:

```sh
# 1. Create the client (idempotent — prints its cli_ id)
pnpm mday client add "Williamstown SC"

# 2. Subscribe it to a league, putting that league in the deep crawl's scope
pnpm mday client add-subscription --client "Williamstown SC" --league lea_xxxxxxxxxxxx

# 3. Issue a bearer token — shown once, never recoverable, only rotatable
pnpm mday client create-token "Williamstown SC"

# 4. Check the result
pnpm mday client list
```

`client list` prints the roster, one line per subscription (`--json` for scripting):

```
CLIENT ID         NAME             TOKENS  SUBSCRIPTION ID   LEAGUE
cli_xxxxxxxxxxxx  Williamstown SC  1       sub_xxxxxxxxxxxx  Div 1 North
                                           sub_yyyyyyyyyyyy  Div 2 South
```

Unwinding either uses the id from that table:

```sh
pnpm mday client remove-subscription sub_xxxxxxxxxxxx
pnpm mday client revoke-token tok_xxxxxxxxxxxx
```

`add-subscription` and `create-token` require an **existing** client and fail on an unknown name —
the client name is a free-text key, so an implicit create would turn a typo into a second silent
tenant holding its own tokens. `client add` is the one command that creates one.

## License

Copyright © 2026 Dejan Vasic. All rights reserved.

Licensed under the [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/).

You may use this software for noncommercial purposes only.
Modification and redistribution are not permitted.
