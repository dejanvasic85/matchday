# matchday

A multi-tenant sports competition data service. It scrapes fixtures, results and tables, then
serves them through an API so many clubs share one dataset.

This monorepo holds the `mday` CLI crawler, the REST API, the published SDK, and the
supporting infrastructure.

## Status

The API, the CLI and the SDK all run. Architecture decision records (ADRs) set the direction,
and we write one before making a significant change.

- Decisions: [docs/decisions](docs/decisions/README.md) — 14 records: 11 decided, 2 proposed, 1
  superseded.
- Build backlog: [GitHub Issues](https://github.com/dejanvasic85/matchday/issues) — grouped by
  phase milestones, labelled with the ADR each item implements.

## Background

matchday came out of the `williamstownsc` project. That project stored fixtures, results and
tables as flat JSON files on disk, and a single Next.js app read them directly. It worked for
one club, but it could not scale to onboarding others — so we split the data out into a
standalone service behind an API.

## Local development

### Running the API

```
vp run --filter @matchday/api dev
```

### Running the `mday` CLI

`mday` is the crawler and administration CLI ([apps/cli](apps/cli/src/cli.ts)). It drives a real
Chrome through playwright-core to clear Dribl's Cloudflare, then calls `mc-api.dribl.com`
directly. In production it runs on GitHub Actions (`crawl-catalog.yml` and `crawl-deep.yml`, per
ADR 0009). The steps below cover running it locally.

**1. Configure the environment.** The CLI loads [apps/cli/.env.local](apps/cli/.env.example)
automatically (gitignored). Copy the example and fill it in:

```sh
cp apps/cli/.env.example apps/cli/.env.local
```

Point `DATABASE_URL` at the Neon **`matchday`** pooled host (`?sslmode=require`).
See [apps/cli/.env.example](apps/cli/.env.example) for every variable; R2 credentials are
required (raw responses are staged there even on a dry run).

> ⚠️ **That is the production database.** There is no separate dev database, because keeping a
> second crawled copy in sync cost more than it was worth. Every local command that writes,
> writes to live data. So use `--dry-run` while you iterate, and treat `client add`,
> `add-subscription` and `create-token` as production changes. Neon branching will give the
> isolation back — a copy-on-write branch of `matchday` that needs no re-crawl — but it is not
> set up yet.

**2. Run a command.** From the repo root, `pnpm mday <command>` forwards straight to the CLI and
passes your arguments through unchanged:

```sh
pnpm mday --help
```

Both crawl commands accept `--dry-run`. That crawls and stages raw responses to R2, but skips
every database write.

### `catalog` — cheap, source-wide

Crawls every competition, league and team (with their clubs) for one source and season, then
upserts the catalog behind the onboarding dropdowns. **Run this first.** It creates the `league`
rows, and their `lea_` ids, that a deep crawl needs.

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

Crawls the fixtures and the table for **exactly one league**. It discovers the clubs and teams as
it goes, and resolves them to entities before saving. Give it one of our internal `lea_` league
ids, not a Dribl id:

```sh
pnpm mday deep-crawl --league lea_xxxxxxxxxxxx

# Stage raw + log a summary without writing to the DB
pnpm mday deep-crawl --league lea_xxxxxxxxxxxx --dry-run
```

To find a `lea_` id, run `catalog` first to populate the leagues, then ask the CLI for the leagues
a club's teams play in:

```sh
pnpm mday club leagues "Williamstown SC"
```

A club name that matches more than one club fails and lists the candidates, so you never crawl the
wrong league by accident.

### `client` — onboarding an API consumer

A client is an API consumer. Its **subscriptions** decide which leagues the deep crawl visits, and
its **tokens** authenticate its requests. Onboarding one takes four commands:

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

To undo either one, use the id from that table:

```sh
pnpm mday client remove-subscription sub_xxxxxxxxxxxx
pnpm mday client revoke-token tok_xxxxxxxxxxxx
```

`add-subscription` and `create-token` both need an **existing** client, and fail on an unknown
name. The client name is free text, so creating one implicitly would turn a typo into a second
silent tenant holding its own tokens. Only `client add` creates a client.

`client` also manages each subscription's optional post-crawl webhook. Run
`pnpm mday client --help` for the full list.

### Other commands

The CLI covers more than the above — `club-enrichment` fetches richer club detail and mirrors
logos to R2, `subscribed-leagues` prints the deep crawl's scope, and `league-team` maintains the
membership table. Run `pnpm mday --help`, then `pnpm mday <command> --help`, for the current set.

## License

Copyright © 2026 Dejan Vasic. All rights reserved.

Licensed under the [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/).

You may use this software for noncommercial purposes only.
Modification and redistribution are not permitted.
