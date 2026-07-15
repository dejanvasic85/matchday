// Turns a MappedFixture (raw Dribl names/ids) into a ready-to-upsert Fixture row: resolves
// home/away team ids (lookup-only — see resolveTeam.ts) and combines them with the
// competition/season/league ids the crawl job already resolved once per tracked competition
// (via resolveLeagueIds' external_ref lookups), rather than re-deriving them from name strings.

import {
  externalRefEntityTypeValue,
  ok,
  type CompetitionId,
  type LeagueId,
  type MappedFixture,
  type Result,
  type SeasonId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "./resolveEntityByExternalRef.ts";
import { resolveTeamForFixture } from "./resolveTeam.ts";

export type FixtureContext = {
  competitionId: CompetitionId;
  seasonId: SeasonId;
  leagueId: LeagueId;
};

// Drizzle's `numeric` columns take string input to preserve precision (Postgres numeric isn't
// representable exactly as a JS float), so the mapper's number | null needs converting here.
function toNumericString(value: number | null): string | null {
  return value === null ? null : value.toString();
}

export async function resolveFixtureEntities(
  deps: EntityResolutionDeps,
  mapped: MappedFixture,
  context: FixtureContext,
): Promise<Result<void>> {
  const { competitionId, seasonId, leagueId } = context;

  const homeTeamResult =
    mapped.homeTeamSourceId !== null
      ? await resolveTeamForFixture(deps, mapped.homeTeamSourceId)
      : ok(null);
  if (!homeTeamResult.ok) {
    return homeTeamResult;
  }

  const awayTeamResult =
    mapped.awayTeamSourceId !== null
      ? await resolveTeamForFixture(deps, mapped.awayTeamSourceId)
      : ok(null);
  if (!awayTeamResult.ok) {
    return awayTeamResult;
  }

  const resolved = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.fixture,
    sourceId: mapped.sourceId,
    upsertEntity: (id) =>
      deps.upsertFixture({
        id,
        leagueId,
        competitionId,
        seasonId,
        round: mapped.round,
        homeTeamId: homeTeamResult.value,
        awayTeamId: awayTeamResult.value,
        venue: mapped.venue,
        latitude: toNumericString(mapped.latitude),
        longitude: toNumericString(mapped.longitude),
        kickoffAt: mapped.kickoffAt,
        status: mapped.status,
        homeScore: mapped.homeScore,
        awayScore: mapped.awayScore,
        isBye: mapped.isBye,
      }),
  });
  if (!resolved.ok) {
    return resolved;
  }

  return ok(undefined);
}
