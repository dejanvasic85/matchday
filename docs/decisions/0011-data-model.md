# 0011. Data model & schema

- Status: decided
- Date: 2026-07-13

## Context

The prior ADRs settle the direction — relational Postgres (0006), app-owned prefixed-nanoid IDs
with an external-reference mapping (0005), self-sufficient capture depth (0004), and
competition-keyed crawling driven by a tracked-competition registry (0002) — but none of them
pins the actual schema: the concrete tables, columns, foreign keys, finalised ID prefixes, and
the migration/ORM tooling. This ADR does that. It is the keystone of Phase 1: every later phase
(domain Zod types, scraper upserts, API resources) builds on the shape defined here.

Two things the earlier ADRs deliberately left open are decided here:

- **ID prefixes** for `league`, `external_ref`, and `tracked_competition` (0005 finalised only
  `clb_`/`tea_`/`cmp_`/`sea_`/`mtc_`/`lad_` and said "finalise during schema design").
- **Schema/migration tooling** — 0006/0009 said "Postgres + migrations tooling" generically.
  `AGENTS.md` and `docs/todo.md` already target Drizzle; this ADR makes it the recorded decision.

## Options

Schema shape is largely dictated by 0004/0005/0006; the genuine choices were:

- **`external_ref` as one polymorphic mapping table** vs per-entity `external_id` columns. A
  single table centralises source-identity resolution and generalises to future sources; per-entity
  columns would duplicate the upsert-by-`(source, source_id)` logic on every table.
- **`league` as its own entity** vs collapsing it into `competition`. 0004 lists
  "Competition/Season/League" as first-class entities and the Dribl API exposes a distinct
  `list/leagues` endpoint keyed by competition+season, so a `league` table matches the source.
- **`status` (and similar constrained fields) as `text` + a TS/Zod union** vs a Postgres `enum`.
  A DB enum enforces values but needs an `ALTER TYPE` migration to change; `text` validated at the
  Zod boundary evolves with a code change only.
- **Drizzle + neon-http** vs other Postgres tooling — chosen for edge/isolate safety and to match
  the already-declared stack.

## Recommendation

### Tooling

**Drizzle ORM + drizzle-kit** for schema and migrations, with **`@neondatabase/serverless`
(neon-http driver)** as the connection driver — HTTP-based and safe inside a V8 isolate, per 0009
("never a raw `pg` TCP connection from a Worker"). The client is built by an injectable
`createDbClient(connectionString)` factory so services and jobs receive it by argument (DI, per
`AGENTS.md`).

**Caveat:** the neon-http driver supports single-shot and batched queries but **not interactive
transactions**. This suits upsert-based ingest and the read-mostly API. A future need for
interactive transactions switches that path to the WebSocket `Pool` driver without touching the
schema.

### Identifiers

App-owned prefixed-nanoid primary keys, stored as `text` (generation lives in `packages/domain`,
Phase 2). Finalised prefixes:

| Prefix | Entity              |
| ------ | ------------------- |
| `clb_` | club                |
| `tea_` | team                |
| `cmp_` | competition         |
| `sea_` | season              |
| `lea_` | league              |
| `mtc_` | fixture (match)     |
| `lad_` | ladder_entry        |
| `ext_` | external_ref        |
| `trk_` | tracked_competition |

### Entities

Every entity table carries `created_at`/`updated_at` (`timestamptz`, default `now()`). Columns are
written camelCase in Drizzle and mapped to snake_case in Postgres via `casing: "snake_case"`.

- **club** — id; `name`, `displayName`, `logoUrl` (our own R2 URL, nullable), `email`, `website`,
  `address`, `socials` (`jsonb`, nullable).
- **team** — id; `clubId` → club; `name`, `ageGroup`, `gender`.
- **competition** — id; `name`.
- **season** — id; `name` (e.g. `"2026"`).
- **league** — id; `name`; `competitionId` → competition, `seasonId` → season. Ties a competition
  to a season (matches 0004 and the Dribl `list/leagues` endpoint).
- **fixture** — id; `leagueId` → league, `competitionId` → competition, `seasonId` → season;
  `round` (`integer`); `homeTeamId` → team, `awayTeamId` → team (nullable for byes); `venue`;
  `latitude`/`longitude` (`numeric(9,6)`, nullable); `kickoffAt` (single `timestamptz` combining
  Dribl's date+time); `status` (`text`); `homeScore`/`awayScore` (`integer`, nullable);
  `isBye` (`boolean`, default false). **Stored once** and joined to both teams (0006).
- **ladder_entry** — id; `leagueId` → league, `competitionId` → competition, `seasonId` → season,
  `teamId` → team; `position`, `played`, `won`, `drawn`, `lost`, `goalsFor`, `goalsAgainst`,
  `goalDifference`, `points` (all `integer`).
- **external_ref** — id; `entityType` (`text`), `internalId` (`text`), `source` (`text`, default
  `'dribl'`), `sourceId` (`text`), `sourceUrl` (`text`, nullable — retains the original Dribl logo
  URL for R2 re-fetch, per 0004). **Unique `(source, sourceId)`** — the idempotency key; unique
  `(entityType, internalId, source)` so an entity has at most one ref per source; index on
  `(entityType, internalId)` for reverse lookup. Polymorphic: no FK on `internalId` (Postgres can't
  FK a polymorphic column); integrity is enforced in the data-access layer.
- **tracked_competition** — id; `competitionId` → competition, `seasonId` → season; `enabled`
  (`boolean`, default true). Unique `(competitionId, seasonId)`. The registry the crawler iterates
  (0002).

### Column-type decisions

- Prefixed-nanoid PKs → `text` (not `uuid`/`varchar(n)`).
- Fixture time → one `timestamptz` (`kickoffAt`), not split `date`+`time` — avoids timezone bugs;
  the Phase 2 mapper combines Dribl's date+time into one UTC instant.
- Coordinates → two `numeric(9,6)` columns, not PostGIS `point` (no spatial queries; avoids an
  extension dependency).
- `socials`/`address` open-ended shape → `jsonb`, typed with Drizzle `.$type<…>()` and validated
  by Zod at the mapper boundary.
- Scores → nullable `integer` (null pre-match / on bye).
- `status`, `gender`, `ageGroup` → `text` validated against an `as const`/Zod union in a co-located
  `constants.ts`, not a DB enum.

## Consequences

- Introduces Drizzle schema + drizzle-kit migrations in `packages/db`; migrations are committed.
- Ingest becomes upserts keyed on `external_ref (source, source_id)` (idempotent re-scraping, 0005).
- The Phase 2 ID service must emit exactly these nine prefixes; branded ID types map to them.
- `league` is a first-class entity, so fixtures and ladder entries carry a `leagueId` FK.
- Worker → Neon uses the neon-http driver (isolate-safe); no interactive transactions on that path.
- Player-level stats remain deferred (0004); adding them later does not rework these tables.
