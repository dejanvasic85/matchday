# 0011. Data model & schema

- Status: decided
- Date: 2026-07-13
- Reshaped by: [0012](0012-subscription-multisource.md) — league-focused subscriptions + multi-source
  ingest; `tracked_competition` subsumed by a subscription entity; `team.clubId` nullable; clubs/teams
  discovered from the crawl (team by `team_hash_id`, club by `club_code`), not enumerated.
- Reshaped by: [0013](0013-api-auth.md) — adds `client` (the tenant entity) and `api_token`;
  `subscription.clientName` becomes `subscription.clientId` → `client.id`.
- Reshaped by: [#141](https://github.com/dejanvasic85/matchday/issues/141) — adds `league_team`
  (a team's membership in a league, independent of `table_entry`) and the `lgt_` prefix. Deriving
  club/league membership from `table_entry` silently misses table-less divisions (e.g. MiniRoos age
  groups, which publish fixtures but no ladder) — `league_team` is written for every discovered
  team regardless of that.

## Context

The earlier ADRs settle the direction: relational Postgres (0006), our own prefixed-nanoid IDs
with an external-reference mapping (0005), self-sufficient capture depth (0004), and
competition-keyed crawling driven by a tracked-competition registry (0002). None of them pins the
actual schema — the concrete tables, columns, foreign keys, final ID prefixes, and the tooling for
migrations.

This ADR does that. It is the keystone of Phase 1, because every later phase builds on the shape
defined here: the domain Zod types, the scraper's upserts, and the API resources.

It also closes two things the earlier ADRs deliberately left open:

- **ID prefixes** for `league`, `external_ref` and `tracked_competition`. 0005 settled only
  `clb_`, `tea_`, `cmp_`, `sea_`, `mtc_` and `lad_`, and left the rest to schema design.
- **Schema and migration tooling.** 0006 and 0009 said only "Postgres and migrations tooling".
  `AGENTS.md` already targets Drizzle, and this ADR makes that the recorded decision.

## Options

0004, 0005 and 0006 dictate most of the schema shape. These were the real choices:

- **One polymorphic `external_ref` table, or an `external_id` column on every entity.** A single
  table keeps source-identity resolution in one place and generalises to future sources.
  Per-entity columns would repeat the upsert-by-`(source, source_id)` logic on every table.
- **`league` as its own entity, or folded into `competition`.** 0004 names competition, season
  and league as first-class entities, and Dribl exposes a separate `list/leagues` endpoint keyed
  by competition and season. A `league` table therefore matches the source.
- **`status` and similar constrained fields as `text` plus a Zod union, or as a Postgres enum.** A
  database enum enforces its values, but changing it needs an `ALTER TYPE` migration. Validating
  `text` at the Zod boundary lets the values change with a code change alone.
- **Drizzle with the neon-http driver, or other Postgres tooling.** We chose Drizzle because it
  is safe inside a V8 isolate and matches the stack we had already declared.

## Recommendation

### Tooling

Use **Drizzle and drizzle-kit** for the schema and migrations, and **`@neondatabase/serverless`**
— the neon-http driver — to connect. That driver speaks HTTP and is safe inside a V8 isolate,
which 0009 requires: never open a raw `pg` TCP connection from a Worker. A
`createDbClient(connectionString)` factory builds the client, so services and jobs receive it by
argument rather than importing it, per `AGENTS.md`.

**One caveat.** The neon-http driver runs single-shot and batched queries, but **not interactive
transactions**. That suits upsert-based ingest and a read-mostly API. If we ever need interactive
transactions, we switch that path to the WebSocket `Pool` driver, and the schema stays as it is.

### Identifiers

We own the primary keys: prefixed nanoids, stored as `text`. `packages/domain` generates them, in
Phase 2. The final prefixes:

| Prefix | Entity              |
| ------ | ------------------- |
| `clb_` | club                |
| `tea_` | team                |
| `cmp_` | competition         |
| `sea_` | season              |
| `lea_` | league              |
| `mtc_` | fixture (match)     |
| `tab_` | table_entry         |
| `lgt_` | league_team         |
| `ext_` | external_ref        |
| `trk_` | tracked_competition |

### Entities

Every entity table carries `created_at` and `updated_at` — both `timestamptz`, defaulting to
`now()`. We write columns in camelCase in Drizzle, and `casing: "snake_case"` maps them to
snake_case in Postgres.

- **club** — id; `name`, `displayName`, `logoUrl` (our own R2 URL, nullable), `email`, `website`,
  `address`, `socials` (`jsonb`, nullable).
- **team** — id; `clubId` → club; `name`.
- **competition** — id; `name`.
- **season** — id; `name` (e.g. `"2026"`).
- **league** — id; `name`; `competitionId` → competition, `seasonId` → season. Ties a competition
  to a season (matches 0004 and the Dribl `list/leagues` endpoint).
- **fixture** — id; `leagueId` → league, `competitionId` → competition, `seasonId` → season;
  `round` (`integer`); `homeTeamId` → team, `awayTeamId` → team (nullable for byes); `venue`;
  `latitude`/`longitude` (`numeric(9,6)`, nullable); `kickoffAt` (single `timestamptz` combining
  Dribl's date+time); `status` (`text`); `homeScore`/`awayScore` (`integer`, nullable);
  `isBye` (`boolean`, default false). **Stored once** and joined to both teams (0006).
- **table_entry** — id; `leagueId` → league, `competitionId` → competition, `seasonId` → season,
  `teamId` → team; `position`, `played`, `won`, `drawn`, `lost`, `goalsFor`, `goalsAgainst`,
  `goalDifference`, `points` (all `integer`). One row per team's standing in a league table.
- **league_team** (#141) — id; `leagueId` → league, `teamId` → team. One row per team's
  _membership_ in a league, unique on `(leagueId, teamId)`, decoupled from `table_entry`: written
  for every team the crawl discovers whether or not that league ever publishes a ladder. No
  `competitionId`/`seasonId` denormalization — both are reachable via `leagueId → league` and this
  table has no reporting use case that needs the shortcut.
- **external_ref** — id; `entityType` (`text`), `internalId` (`text`), `source` (`text`, default
  `'dribl'`), `sourceId` (`text`), `sourceUrl` (`text`, nullable — retains the original Dribl logo
  URL for R2 re-fetch, per 0004). **Unique `(source, sourceId)`** — the idempotency key; unique
  `(entityType, internalId, source)` so an entity has at most one ref per source; index on
  `(entityType, internalId)` for reverse lookup. Polymorphic: no FK on `internalId` (Postgres can't
  FK a polymorphic column); integrity is enforced in the data-access layer.
- **tracked_competition** — id; `competitionId` → competition, `seasonId` → season; `enabled`
  (`boolean`, default true). Unique `(competitionId, seasonId)`. The registry the crawler iterates
  (0002).

### Column types, and why

- **Primary keys → `text`**, not `uuid` or `varchar(n)`, because they are prefixed nanoids.
- **Fixture time → one `timestamptz`** called `kickoffAt`, rather than separate `date` and `time`
  columns. One instant avoids timezone bugs, and the Phase 2 mapper combines Dribl's date and
  time into a single UTC instant.
- **Coordinates → two `numeric(9,6)` columns**, not a PostGIS `point`. We run no spatial queries,
  so this avoids depending on an extension.
- **`socials` and `address` → `jsonb`**, because their shape is open-ended. Drizzle types them
  with `.$type<…>()`, and Zod validates them at the mapper boundary.
- **Scores → nullable `integer`**, since they are null before a match and on a bye.
- **`status` → `text`**, validated against an `as const` Zod union in a co-located `constants.ts`
  rather than a database enum.

## Consequences

- We add a Drizzle schema and drizzle-kit migrations in `packages/db`, and commit the migrations.
- Ingest becomes upserts keyed on `external_ref (source, source_id)`, so re-scraping is idempotent
  (0005).
- The Phase 2 ID service must emit exactly the prefixes in the table above, and the branded ID
  types map to them.
- `league` is a first-class entity, so fixtures and table entries carry a `leagueId` foreign key.
- The Worker reaches Neon through the neon-http driver, which is isolate-safe. That path runs no
  interactive transactions.
- Player-level stats stay deferred (0004). Adding them later reworks none of these tables.
