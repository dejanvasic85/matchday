// Data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { err, ok, type Result } from "@matchday/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { Source } from "./constants.ts";
import {
  club,
  competition,
  externalRef,
  fixture,
  league,
  season,
  tableEntry,
  team,
} from "./schema.ts";

type Club = typeof club.$inferSelect;
type ClubInsert = typeof club.$inferInsert;
type Team = typeof team.$inferSelect;
type TeamInsert = typeof team.$inferInsert;
type Competition = typeof competition.$inferSelect;
type CompetitionInsert = typeof competition.$inferInsert;
type Season = typeof season.$inferSelect;
type SeasonInsert = typeof season.$inferInsert;
type League = typeof league.$inferSelect;
type LeagueInsert = typeof league.$inferInsert;
type Fixture = typeof fixture.$inferSelect;
type FixtureInsert = typeof fixture.$inferInsert;
type TableEntry = typeof tableEntry.$inferSelect;
type TableEntryInsert = typeof tableEntry.$inferInsert;
type ExternalRef = typeof externalRef.$inferSelect;
type ExternalRefInsert = typeof externalRef.$inferInsert;

function toError(cause: unknown, message: string): Result<never> {
  return err({ message, cause });
}

export async function listClubs(db: Db): Promise<Result<Club[]>> {
  try {
    const rows = await db.select().from(club);
    return ok(rows);
  } catch (cause) {
    return toError(cause, "Failed to list clubs");
  }
}

export async function getClubById(db: Db, id: string): Promise<Result<Club | null>> {
  try {
    const rows = await db.select().from(club).where(eq(club.id, id)).limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to get club by id");
  }
}

/**
 * Find a club by its exact logo URL — the more precise of the two lookups (avoids name
 * collisions between similarly-named clubs), tried first when linking a team to a club from
 * table-entry data, which carries only a club name/logo (no stable Dribl club id).
 */
export async function findClubByLogoUrl(db: Db, logoUrl: string): Promise<Result<Club | null>> {
  try {
    const rows = await db.select().from(club).where(eq(club.logoUrl, logoUrl)).limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to find club by logo url");
  }
}

/**
 * Find a club by its exact name — the fallback when no logo match is found. The clubs-sync job
 * (Phase 3, not yet built) is the source of truth for club identity and matches by name/logo to
 * attach its external_ref to whichever club row this created, rather than creating a duplicate.
 */
export async function findClubByName(db: Db, name: string): Promise<Result<Club | null>> {
  try {
    const rows = await db.select().from(club).where(eq(club.name, name)).limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to find club by name");
  }
}

/**
 * Upsert a club by its (already-generated) id: insert it, or refresh its scraped fields if the
 * id is already known. The entity-resolution service (Phase 3) generates the id up front so it
 * can also write the matching `external_ref` row in the same call.
 *
 * The update branch fully overwrites email/website/address/socials with `values` — today the
 * only caller (resolveClub, created from table-entry data) always passes those as null, so this
 * is a no-op in practice. A future clubs-sync job upserting curated club detail must pass its
 * own real values here, or this will null out previously-curated fields on a re-crawl.
 */
export async function upsertClub(db: Db, values: ClubInsert): Promise<Result<Club>> {
  try {
    const rows = await db
      .insert(club)
      .values(values)
      .onConflictDoUpdate({
        target: club.id,
        set: {
          name: values.name,
          displayName: values.displayName,
          logoUrl: values.logoUrl ?? null,
          email: values.email ?? null,
          website: values.website ?? null,
          address: values.address ?? null,
          socials: values.socials ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of club returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert club");
  }
}

export async function upsertTeam(db: Db, values: TeamInsert): Promise<Result<Team>> {
  try {
    const rows = await db
      .insert(team)
      .values(values)
      .onConflictDoUpdate({
        target: team.id,
        set: {
          clubId: values.clubId,
          name: values.name,
          ageGroup: values.ageGroup ?? null,
          gender: values.gender ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of team returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert team");
  }
}

export async function upsertCompetition(
  db: Db,
  values: CompetitionInsert,
): Promise<Result<Competition>> {
  try {
    const rows = await db
      .insert(competition)
      .values(values)
      .onConflictDoUpdate({
        target: competition.id,
        set: { name: values.name, updatedAt: new Date() },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of competition returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert competition");
  }
}

export async function upsertSeason(db: Db, values: SeasonInsert): Promise<Result<Season>> {
  try {
    const rows = await db
      .insert(season)
      .values(values)
      .onConflictDoUpdate({
        target: season.id,
        set: { name: values.name, updatedAt: new Date() },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of season returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert season");
  }
}

export async function upsertLeague(db: Db, values: LeagueInsert): Promise<Result<League>> {
  try {
    const rows = await db
      .insert(league)
      .values(values)
      .onConflictDoUpdate({
        target: league.id,
        set: {
          name: values.name,
          competitionId: values.competitionId,
          seasonId: values.seasonId,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of league returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert league");
  }
}

export async function upsertFixture(db: Db, values: FixtureInsert): Promise<Result<Fixture>> {
  try {
    const rows = await db
      .insert(fixture)
      .values(values)
      .onConflictDoUpdate({
        target: fixture.id,
        set: {
          leagueId: values.leagueId,
          competitionId: values.competitionId,
          seasonId: values.seasonId,
          round: values.round ?? null,
          homeTeamId: values.homeTeamId ?? null,
          awayTeamId: values.awayTeamId ?? null,
          venue: values.venue ?? null,
          latitude: values.latitude ?? null,
          longitude: values.longitude ?? null,
          kickoffAt: values.kickoffAt ?? null,
          status: values.status,
          homeScore: values.homeScore ?? null,
          awayScore: values.awayScore ?? null,
          isBye: values.isBye,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of fixture returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert fixture");
  }
}

/**
 * Upsert a table entry by its `(league_id, team_id)` idempotency key: a team appears at most
 * once per league's table, so re-crawling the same league updates the existing row for that
 * team instead of inserting a duplicate. No `external_ref` involved — the whole ladder is
 * re-fetched and replaced each crawl, so there's no stable per-row Dribl id worth tracking.
 */
export async function upsertTableEntry(
  db: Db,
  values: TableEntryInsert,
): Promise<Result<TableEntry>> {
  try {
    const rows = await db
      .insert(tableEntry)
      .values(values)
      .onConflictDoUpdate({
        target: [tableEntry.leagueId, tableEntry.teamId],
        set: {
          competitionId: values.competitionId,
          seasonId: values.seasonId,
          position: values.position,
          played: values.played,
          won: values.won,
          drawn: values.drawn,
          lost: values.lost,
          goalsFor: values.goalsFor,
          goalsAgainst: values.goalsAgainst,
          goalDifference: values.goalDifference,
          points: values.points,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(values, "Upsert of table entry returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert table entry");
  }
}

/**
 * Upsert an external reference by its `(source, sourceId)` idempotency key (ADR 0005): insert it,
 * or update the mapping/metadata if that source hash is already known. The single primitive the
 * scraper's idempotent re-scraping (Phase 3) builds on.
 */
export async function upsertExternalRef(
  db: Db,
  ref: ExternalRefInsert,
): Promise<Result<ExternalRef>> {
  try {
    const rows = await db
      .insert(externalRef)
      .values(ref)
      .onConflictDoUpdate({
        target: [externalRef.source, externalRef.sourceId],
        set: {
          entityType: ref.entityType,
          internalId: ref.internalId,
          sourceUrl: ref.sourceUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(ref, "Upsert of external ref returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert external ref");
  }
}

export async function findExternalRef(
  db: Db,
  source: Source,
  sourceId: string,
): Promise<Result<ExternalRef | null>> {
  try {
    const rows = await db
      .select()
      .from(externalRef)
      .where(and(eq(externalRef.source, source), eq(externalRef.sourceId, sourceId)))
      .limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to find external ref");
  }
}
