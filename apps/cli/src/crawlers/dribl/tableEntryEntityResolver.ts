// Turns a MappedTableEntry (raw Dribl names/ids) into a ready-to-upsert TableEntry row: resolves
// (creating if new) the club + team, then combines with the competition/season/league ids the
// crawl job already resolved once per tracked competition. No external_ref for the table entry
// itself — see upsertTableEntry's (league_id, team_id) idempotency key.

import {
  generateId,
  ok,
  type CompetitionId,
  type LeagueId,
  type Result,
  type SeasonId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import type { MappedTableEntry } from "#crawlers/dribl/mappers/mapDriblTableEntry.ts";
import { resolveTeamForTableEntry } from "#crawlers/dribl/teamResolver.ts";

export type TableEntryContext = {
  competitionId: CompetitionId;
  seasonId: SeasonId;
  leagueId: LeagueId;
};

export async function resolveTableEntryEntities(
  deps: EntityResolutionDeps,
  mapped: MappedTableEntry,
  context: TableEntryContext,
): Promise<Result<void>> {
  const { competitionId, seasonId, leagueId } = context;

  const teamResult = await resolveTeamForTableEntry({
    deps,
    teamSourceId: mapped.teamSourceId,
    teamName: mapped.teamName,
    clubName: mapped.clubName,
    clubLogoUrl: mapped.clubLogoUrl,
    clubCode: mapped.clubCode,
  });
  if (!teamResult.ok) {
    return teamResult;
  }

  const upserted = await deps.upsertTableEntry({
    id: generateId("tableEntry"),
    leagueId,
    competitionId,
    seasonId,
    teamId: teamResult.value,
    position: mapped.position,
    played: mapped.played,
    won: mapped.won,
    drawn: mapped.drawn,
    lost: mapped.lost,
    goalsFor: mapped.goalsFor,
    goalsAgainst: mapped.goalsAgainst,
    goalDifference: mapped.goalDifference,
    points: mapped.points,
  });
  if (!upserted.ok) {
    return upserted;
  }

  return ok(undefined);
}
