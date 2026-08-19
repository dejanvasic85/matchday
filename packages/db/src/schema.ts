// Drizzle schema for matchday's Postgres (Neon), modelling ADR 0011.
// Camelcase field names map to snake_case columns via `casing: "snake_case"` on the client.
// Primary keys are app-owned prefixed-nanoid strings (generated in @matchday/domain, Phase 2).

import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { FixtureStatus, Source } from "#constants.ts";

/** Open-ended `platform -> url` map for a club's social links. */
export type Socials = Record<string, string>;

/** A club's home ground, as returned by Dribl's `clubs/{id}` (at most one, despite the name). */
export type Ground = { name: string; address: string | null };

/** Timestamp columns every entity carries. */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const club = pgTable("club", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  logoUrl: text("logo_url"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  socials: jsonb("socials").$type<Socials>(),
  grounds: jsonb("grounds").$type<Ground>(),
  color: text("color"),
  accent: text("accent"),
  store: text("store"),
  ...timestamps,
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  clubId: text("club_id").references(() => club.id),
  name: text("name").notNull(),
  ...timestamps,
});

export const competition = pgTable("competition", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const season = pgTable("season", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const league = pgTable("league", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  competitionId: text("competition_id")
    .notNull()
    .references(() => competition.id),
  seasonId: text("season_id")
    .notNull()
    .references(() => season.id),
  ...timestamps,
});

export const fixture = pgTable("fixture", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => league.id),
  competitionId: text("competition_id")
    .notNull()
    .references(() => competition.id),
  seasonId: text("season_id")
    .notNull()
    .references(() => season.id),
  round: integer("round"),
  homeTeamId: text("home_team_id").references(() => team.id),
  awayTeamId: text("away_team_id").references(() => team.id),
  venue: text("venue"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
  status: text("status").$type<FixtureStatus>().notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  isBye: boolean("is_bye").notNull().default(false),
  ...timestamps,
});

export const tableEntry = pgTable(
  "table_entry",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => league.id),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competition.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => season.id),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id),
    position: integer("position").notNull(),
    played: integer("played").notNull(),
    won: integer("won").notNull(),
    drawn: integer("drawn").notNull(),
    lost: integer("lost").notNull(),
    goalsFor: integer("goals_for").notNull(),
    goalsAgainst: integer("goals_against").notNull(),
    goalDifference: integer("goal_difference").notNull(),
    points: integer("points").notNull(),
    ...timestamps,
  },
  (table) => [
    // A team appears at most once per league's table; re-crawling the same league updates
    // this row instead of inserting a duplicate (no external_ref — the whole ladder is
    // re-fetched and replaced each crawl, so there's no stable per-row Dribl id worth tracking).
    uniqueIndex("table_entry_league_team_key").on(table.leagueId, table.teamId),
  ],
);

export const externalRef = pgTable(
  "external_ref",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    internalId: text("internal_id").notNull(),
    source: text("source").$type<Source>().notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url"),
    ...timestamps,
  },
  (table) => [
    // Idempotency key: a source hash maps to exactly one internal entity (ADR 0005).
    uniqueIndex("external_ref_source_source_id_key").on(table.source, table.sourceId),
    // An entity has at most one ref per source.
    uniqueIndex("external_ref_entity_source_key").on(
      table.entityType,
      table.internalId,
      table.source,
    ),
    // Reverse lookup: internal id -> its source refs.
    index("external_ref_entity_idx").on(table.entityType, table.internalId),
  ],
);

// A client of the API (ADR 0013): the entity both subscriptions and API tokens belong to.
export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("client_name_key").on(table.name)],
);

// A client subscribes to one of our leagues (ADR 0012): drives the deep crawl (fixtures + tables
// are crawled only for subscribed leagues). Keyed on our internal `league.id` — the league already
// ties competition + season (0011), so the subscription is season-scoped through it. Subsumes the
// old tracked_competition.
export const subscription = pgTable(
  "client_subscription",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id),
    leagueId: text("league_id")
      .notNull()
      .references(() => league.id),
    // Soft delete: `client remove-subscription` sets this instead of deleting the row, so the
    // (client, league) history survives and re-subscribing (the upsert's conflict branch) can
    // revive the same row by clearing it, rather than colliding with the still-unique
    // (client_id, league_id) index below.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Optional post-crawl notification target (#105): set/cleared through a dedicated CLI path,
    // never touched by the subscribe/re-subscribe upsert, so re-subscribing a client to a league
    // can't silently wipe an already-configured webhook.
    webhookUrl: text("webhook_url"),
    // HMAC-SHA256 key for signing webhook deliveries (`X-Matchday-Signature`), shown once when
    // set. Stored in plaintext (unlike `client_api_token.token_hash`) because we, not the
    // receiver, compute the signature — there's nothing to hash-and-compare against.
    webhookSecret: text("webhook_secret"),
    ...timestamps,
  },
  (table) => [
    // One *active* subscription per (client, league) — enforced in application code (the upsert
    // revives a soft-deleted row instead of inserting a second one), since a partial unique index
    // scoped to `deleted_at is null` isn't expressible through Drizzle's `uniqueIndex` builder.
    uniqueIndex("client_subscription_client_league_key").on(table.clientId, table.leagueId),
  ],
);

// A client's API bearer token (ADR 0013), hashed at rest — the row never holds the plaintext
// token, only its hash, looked up on each request. A client can hold multiple active tokens at
// once (like an AWS access key pair) so it can roll a new one in before revoking the old.
export const apiToken = pgTable(
  "client_api_token",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => client.id),
    tokenHash: text("token_hash").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("client_api_token_token_hash_key").on(table.tokenHash),
    index("client_api_token_client_idx").on(table.clientId),
  ],
);

export const clubRelations = relations(club, ({ many }) => ({
  teams: many(team),
}));

export const teamRelations = relations(team, ({ one }) => ({
  club: one(club, { fields: [team.clubId], references: [club.id] }),
}));

export const competitionRelations = relations(competition, ({ many }) => ({
  seasons: many(season),
  leagues: many(league),
}));

export const leagueRelations = relations(league, ({ one, many }) => ({
  competition: one(competition, {
    fields: [league.competitionId],
    references: [competition.id],
  }),
  season: one(season, { fields: [league.seasonId], references: [season.id] }),
  fixtures: many(fixture),
  tableEntries: many(tableEntry),
  subscriptions: many(subscription),
}));

export const fixtureRelations = relations(fixture, ({ one }) => ({
  league: one(league, { fields: [fixture.leagueId], references: [league.id] }),
  competition: one(competition, {
    fields: [fixture.competitionId],
    references: [competition.id],
  }),
  season: one(season, { fields: [fixture.seasonId], references: [season.id] }),
  homeTeam: one(team, { fields: [fixture.homeTeamId], references: [team.id] }),
  awayTeam: one(team, { fields: [fixture.awayTeamId], references: [team.id] }),
}));

export const tableEntryRelations = relations(tableEntry, ({ one }) => ({
  league: one(league, { fields: [tableEntry.leagueId], references: [league.id] }),
  team: one(team, { fields: [tableEntry.teamId], references: [team.id] }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  league: one(league, { fields: [subscription.leagueId], references: [league.id] }),
  client: one(client, { fields: [subscription.clientId], references: [client.id] }),
}));

export const clientRelations = relations(client, ({ many }) => ({
  subscriptions: many(subscription),
  apiTokens: many(apiToken),
}));

export const apiTokenRelations = relations(apiToken, ({ one }) => ({
  client: one(client, { fields: [apiToken.clientId], references: [client.id] }),
}));
