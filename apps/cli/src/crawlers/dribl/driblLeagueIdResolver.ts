// Resolves Dribl `{season, competition, league}` hashes by walking `external_ref` in reverse —
// the catalog crawl already populated these, so no name-matching (unlike leagueIdResolver.ts).

import {
  externalRefEntityTypeValue,
  notFound,
  ok,
  parseId,
  serverError,
  sourceValue,
  type CompetitionId,
  type LeagueId,
  type Result,
  type SeasonId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type DriblLeagueHashes = {
  season: string;
  competition: string;
  league: string;
};

export type DeepCrawlLeagueContext = {
  competitionId: CompetitionId;
  seasonId: SeasonId;
  leagueId: LeagueId;
  hasTable: boolean;
};

export type ResolveDriblLeagueIdsInput = {
  deps: Pick<EntityResolutionDeps, "getLeagueById" | "findExternalRefByInternalId">;
  leagueId: LeagueId;
};

export type ResolveDriblLeagueIdsResult = {
  hashes: DriblLeagueHashes;
  context: DeepCrawlLeagueContext;
};

async function resolveHash(
  deps: Pick<EntityResolutionDeps, "findExternalRefByInternalId">,
  entityType: "league" | "competition" | "season",
  internalId: string,
): Promise<Result<string>> {
  const ref = await deps.findExternalRefByInternalId(entityType, internalId, sourceValue.dribl);
  if (!ref.ok) {
    return ref;
  }
  if (ref.value === null) {
    return notFound(`No dribl external_ref found for ${entityType} "${internalId}"`);
  }
  return ok(ref.value.sourceId);
}

export async function resolveDriblLeagueIds(
  input: ResolveDriblLeagueIdsInput,
): Promise<Result<ResolveDriblLeagueIdsResult>> {
  const { deps, leagueId } = input;

  const leagueRow = await deps.getLeagueById(leagueId);
  if (!leagueRow.ok) {
    return leagueRow;
  }
  if (leagueRow.value === null) {
    return notFound(`League "${leagueId}" not found`);
  }

  const competitionId = parseId(leagueRow.value.competitionId, "competition");
  const seasonId = parseId(leagueRow.value.seasonId, "season");
  if (competitionId === undefined || seasonId === undefined) {
    return serverError(`League "${leagueId}" has malformed competition/season ids`);
  }

  const leagueHash = await resolveHash(deps, externalRefEntityTypeValue.league, leagueId);
  if (!leagueHash.ok) {
    return leagueHash;
  }
  const competitionHash = await resolveHash(
    deps,
    externalRefEntityTypeValue.competition,
    competitionId,
  );
  if (!competitionHash.ok) {
    return competitionHash;
  }
  const seasonHash = await resolveHash(deps, externalRefEntityTypeValue.season, seasonId);
  if (!seasonHash.ok) {
    return seasonHash;
  }

  return ok({
    hashes: {
      season: seasonHash.value,
      competition: competitionHash.value,
      league: leagueHash.value,
    },
    context: { competitionId, seasonId, leagueId, hasTable: leagueRow.value.hasTable ?? false },
  });
}
