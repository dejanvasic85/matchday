// Team resolution differs by caller: fixture data has a team name + Dribl team hash id but no
// club name, so a team can't be safely created there without guessing its club — lookup only,
// leaving the fixture's team id null if unknown (the schema already allows null, for byes).
// Table-entry data carries team name + club name together, so it's the one place that creates
// teams, resolving/creating the club alongside.

import {
  err,
  externalRefEntityTypeValue,
  ok,
  parseId,
  sourceValue,
  type Result,
  type TeamId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";
import { resolveClub } from "./clubResolver.ts";
import { resolveEntityByExternalRef } from "./externalRefEntityResolver.ts";

/** `null` when no team with this Dribl id has been seen yet (not an error). */
export async function resolveTeamForFixture(
  deps: Pick<EntityResolutionDeps, "findExternalRef">,
  teamSourceId: string,
): Promise<Result<TeamId | null>> {
  const existing = await deps.findExternalRef(sourceValue.dribl, teamSourceId);
  if (!existing.ok) {
    return existing;
  }
  if (existing.value === null) {
    return ok(null);
  }

  const teamId = parseId(existing.value.internalId, "team");
  if (teamId === undefined) {
    return err({
      message: `external_ref internalId "${existing.value.internalId}" doesn't match expected prefix for "team"`,
    });
  }
  return ok(teamId);
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
