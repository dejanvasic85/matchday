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
import type { FixtureStatus, Source } from "./constants.ts";

/** Open-ended `platform -> url` map for a club's social links. */
export type Socials = Record<string, string>;

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
  ...timestamps,
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  clubId: text("club_id")
    .notNull()
    .references(() => club.id),
  name: text("name").notNull(),
  ageGroup: text("age_group"),
  gender: text("gender"),
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

export const ladderEntry = pgTable("ladder_entry", {
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
});

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

export const trackedCompetition = pgTable(
  "tracked_competition",
  {
    id: text("id").primaryKey(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competition.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => season.id),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tracked_competition_comp_season_key").on(table.competitionId, table.seasonId),
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
  ladderEntries: many(ladderEntry),
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

export const ladderEntryRelations = relations(ladderEntry, ({ one }) => ({
  league: one(league, { fields: [ladderEntry.leagueId], references: [league.id] }),
  team: one(team, { fields: [ladderEntry.teamId], references: [team.id] }),
}));

export const trackedCompetitionRelations = relations(trackedCompetition, ({ one }) => ({
  competition: one(competition, {
    fields: [trackedCompetition.competitionId],
    references: [competition.id],
  }),
  season: one(season, {
    fields: [trackedCompetition.seasonId],
    references: [season.id],
  }),
}));
