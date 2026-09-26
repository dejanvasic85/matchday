// Competition-season data access: the per-competition window. Every read/write of a season's
// calendar goes through here — a `season` row carries no dates of its own.

import { ok, type IsoDate, type Result, type Source } from "@matchday/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition, competitionSeason, season } from "#schema.ts";

type CompetitionSeason = typeof competitionSeason.$inferSelect;
export type CompetitionSeasonInsert = typeof competitionSeason.$inferInsert;

/** One row of a flat season listing: the season it belongs to, the competition that runs it, and
 * the calendar window. `mday season list` renders this directly. */
export type CompetitionSeasonWindow = {
  seasonId: string;
  seasonName: string;
  source: Source;
  competitionId: string;
  competitionName: string;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

/** Create the competition-season row if it isn't there yet, leaving any dates an operator set
 * untouched. The catalog crawl calls this for every competition it sees, so a note exists even
 * before its window is known. Does nothing on conflict, so a re-crawl writes no rows. */
export async function ensureCompetitionSeason(
  db: Db,
  values: CompetitionSeasonInsert,
): Promise<Result<void>> {
  const result = await runQuery(
    () =>
      db
        .insert(competitionSeason)
        .values(values)
        .onConflictDoNothing({
          target: [competitionSeason.competitionId, competitionSeason.seasonId],
        }),
    "Failed to ensure competition season",
  );
  return result.ok ? ok(undefined) : result;
}

/** Write a competition-season's window, creating the row when it doesn't exist yet (a season with
 * no league crawled, or a competition the catalog hasn't reached). */
export async function setCompetitionSeasonDates(
  db: Db,
  values: CompetitionSeasonInsert,
): Promise<Result<CompetitionSeason>> {
  return runUpsert(
    () =>
      db
        .insert(competitionSeason)
        .values(values)
        .onConflictDoUpdate({
          target: [competitionSeason.competitionId, competitionSeason.seasonId],
          set: {
            startsOn: values.startsOn ?? null,
            endsOn: values.endsOn ?? null,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "competition season",
    values,
  );
}

/** Every competition-season window, joined to its season and competition, source-then-name
 * ordered. Small enough (one row per competition per season) to return unpaged. */
export async function listSeasonWindows(
  db: Db,
  filter: { source?: Source } = {},
): Promise<Result<CompetitionSeasonWindow[]>> {
  const result = await runQuery(
    () =>
      db
        .select({
          seasonId: season.id,
          seasonName: season.name,
          source: season.source,
          competitionId: competition.id,
          competitionName: competition.name,
          startsOn: competitionSeason.startsOn,
          endsOn: competitionSeason.endsOn,
        })
        .from(competitionSeason)
        .innerJoin(season, eq(season.id, competitionSeason.seasonId))
        .innerJoin(competition, eq(competition.id, competitionSeason.competitionId))
        .where(filter.source === undefined ? undefined : eq(season.source, filter.source))
        .orderBy(asc(season.source), asc(season.name), asc(competition.name)),
    "Failed to list season windows",
  );
  return result.ok ? ok(result.value) : result;
}

/** The window for one competition's run in one season, or `null` when the catalog crawl hasn't
 * created it yet. */
export async function getCompetitionSeason(
  db: Db,
  competitionId: string,
  seasonId: string,
): Promise<Result<CompetitionSeason | null>> {
  const result = await runQuery(
    () =>
      db
        .select()
        .from(competitionSeason)
        .where(
          and(
            eq(competitionSeason.competitionId, competitionId),
            eq(competitionSeason.seasonId, seasonId),
          ),
        )
        .limit(1),
    "Failed to get competition season",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
