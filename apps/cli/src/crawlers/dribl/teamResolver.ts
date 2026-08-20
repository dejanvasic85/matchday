// Fixture data has no club_code, so it can't resolve a club by identity — it bridges instead via
// findClubBridgeMatch (logo survives team-name suffixes like "Altona North SC U08"). If the club
// can't be bridged yet, the team is still created unlinked (clubId: null) rather than blocked;
// every subsequent sighting retries the bridge, so it self-heals once the club shows up elsewhere.
// resolveTeamForTableEntry is the one place that resolves the club from source data alone (table
// rows carry team name + club name together).

import {
  externalRefEntityTypeValue,
  ok,
  parseId,
  serverError,
  sourceValue,
  type Logger,
  type Result,
  type TeamId,
} from "@matchday/domain";
import { findClubBridgeMatch } from "#crawlers/dribl/clubBridgeResolver.ts";
import { resolveClub } from "#crawlers/dribl/clubResolver.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/dribl/externalRefEntityResolver.ts";

type ResolveTeamForFixtureDeps = Pick<
  EntityResolutionDeps,
  | "findClubByExternalRefSourceUrl"
  | "findClubByLogoUrl"
  | "findClubByName"
  | "findExternalRef"
  | "getTeamById"
  | "upsertExternalRef"
  | "upsertTeam"
>;

/** A logo was available to bridge on but nothing matched — worth a look, unlike a null logo
 * (nothing to try in the first place) or a genuinely-unseen-elsewhere club (expected, common). */
function logUnmatchedBridge(logger: Logger, teamName: string, teamLogoUrl: string | null): void {
  if (teamLogoUrl === null) {
    return;
  }
  logger.info("catalog.teamBridge.unmatched", "fixture team's logo matched no known club", {
    teamName,
    teamLogoUrl,
  });
}

async function bridgeUnlinkedTeam(
  deps: ResolveTeamForFixtureDeps,
  logger: Logger,
  teamId: TeamId,
  teamName: string,
  teamLogoUrl: string | null,
): Promise<Result<TeamId>> {
  const current = await deps.getTeamById(teamId);
  if (!current.ok) {
    return current;
  }
  if (current.value === null || current.value.clubId !== null) {
    return ok(teamId);
  }

  const bridgeMatch = await findClubBridgeMatch(deps, teamName, teamLogoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }
  if (bridgeMatch.value === null) {
    logUnmatchedBridge(logger, teamName, teamLogoUrl);
    return ok(teamId);
  }

  const updated = await deps.upsertTeam({
    id: teamId,
    clubId: bridgeMatch.value,
    name: current.value.name,
  });
  return updated.ok ? ok(teamId) : updated;
}

export async function resolveTeamForFixture(
  deps: ResolveTeamForFixtureDeps,
  logger: Logger,
  teamSourceId: string,
  teamName: string,
  teamLogoUrl: string | null,
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
    return bridgeUnlinkedTeam(deps, logger, teamId, teamName, teamLogoUrl);
  }

  const bridgeMatch = await findClubBridgeMatch(deps, teamName, teamLogoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }
  if (bridgeMatch.value === null) {
    logUnmatchedBridge(logger, teamName, teamLogoUrl);
  }

  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    sourceId: teamSourceId,
    upsertEntity: (id) =>
      deps.upsertTeam({
        id,
        clubId: bridgeMatch.value,
        name: teamName,
      }),
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
      }),
  });
}
