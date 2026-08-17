// Team resolution differs by caller: fixture data has a team name + Dribl team hash id but no
// club name, so it creates an *unlinked* team (clubId: null) on first sight rather than guessing
// a club — resolveTeamForTableEntry links it later if this team's league ever produces a table.
// Some leagues never do (e.g. MiniRoos junior age groups, which have fixtures but no table), so
// this is also how those teams get discovered at all — see catalogCrawler's fixture fallback.
// Table-entry data carries team name + club name together, so it's the one place that resolves
// (and can update) the club a team belongs to.

import {
  externalRefEntityTypeValue,
  ok,
  parseId,
  serverError,
  sourceValue,
  type Result,
  type TeamId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { resolveClub } from "#crawlers/dribl/clubResolver.ts";
import { resolveEntityByExternalRef } from "#crawlers/dribl/externalRefEntityResolver.ts";

export async function resolveTeamForFixture(
  deps: Pick<EntityResolutionDeps, "findExternalRef" | "upsertExternalRef" | "upsertTeam">,
  teamSourceId: string,
  teamName: string,
): Promise<Result<TeamId>> {
  const existing = await deps.findExternalRef(sourceValue.dribl, teamSourceId);
  if (!existing.ok) {
    return existing;
  }
  if (existing.value !== null) {
    const teamId = parseId(existing.value.internalId, "team");
    if (teamId === undefined) {
      return serverError(
        `external_ref internalId "${existing.value.internalId}" doesn't match expected prefix for "team"`,
      );
    }
    return ok(teamId);
  }

  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    sourceId: teamSourceId,
    upsertEntity: (id) =>
      deps.upsertTeam({ id, clubId: null, name: teamName, ageGroup: null, gender: null }),
  });
}

export type ResolveTeamForTableEntryInput = {
  deps: EntityResolutionDeps;
  teamSourceId: string;
  teamName: string;
  clubName: string;
  clubLogoUrl: string | null;
  clubCode: string;
};

export async function resolveTeamForTableEntry(
  input: ResolveTeamForTableEntryInput,
): Promise<Result<TeamId>> {
  const { deps, teamSourceId, teamName, clubName, clubLogoUrl, clubCode } = input;

  const clubResult = await resolveClub({ deps, name: clubName, logoUrl: clubLogoUrl, clubCode });
  if (!clubResult.ok) {
    return clubResult;
  }
  const clubId = clubResult.value;

  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    sourceId: teamSourceId,
    upsertEntity: (id) =>
      deps.upsertTeam({
        id,
        clubId,
        name: teamName,
        ageGroup: null,
        gender: null,
      }),
  });
}
