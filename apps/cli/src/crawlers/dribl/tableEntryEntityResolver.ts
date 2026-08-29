// Turns a MappedTableEntry into a ready-to-upsert TableEntry row. No external_ref for the table
// entry itself — see upsertTableEntry's (league_id, team_id) idempotency key.

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

  // Membership independent of the table row above — club/league lookups join on this
  // rather than table_entry, so they still work for leagues that lose their table later.
  const membership = await deps.upsertLeagueTeam({
    id: generateId("leagueTeam"),
    leagueId,
    teamId: teamResult.value,
  });
  if (!membership.ok) {
    return membership;
  }

  return ok(undefined);
}
