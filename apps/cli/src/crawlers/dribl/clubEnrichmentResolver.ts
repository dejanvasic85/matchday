// Resolves a source id to an *existing* club row only — never creates one (ADR 0012). Returns
// `null` (not an error) for admin pseudo-clubs or a row already claimed by a different source id.

import {
  externalRefEntityTypeValue,
  generateId,
  ok,
  parseId,
  serverError,
  sourceValue,
  type ClubId,
  type Result,
} from "@matchday/domain";
import { findClubBridgeMatch } from "#crawlers/dribl/clubBridgeResolver.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type ResolveClubForEnrichmentInput = {
  deps: Pick<
    EntityResolutionDeps,
    | "findClubByExternalRefSourceUrl"
    | "findClubByLogoUrl"
    | "findClubByName"
    | "findExternalRef"
    | "findExternalRefByInternalId"
    | "upsertExternalRef"
  >;
  sourceId: string;
  name: string;
  logoUrl: string | null;
};

function toClubId(id: string): Result<ClubId> {
  const clubId = parseId(id, "club");
  if (clubId === undefined) {
    return serverError(`Club row id "${id}" doesn't have the expected "clb_" prefix`);
  }
  return ok(clubId);
}

export async function resolveClubForEnrichment(
  input: ResolveClubForEnrichmentInput,
): Promise<Result<ClubId | null>> {
  const { deps, sourceId, name, logoUrl } = input;

  // 1. A prior run already bridged this club — resolve directly.
  const existingRef = await deps.findExternalRef(sourceValue.dribl, sourceId);
  if (!existingRef.ok) {
    return existingRef;
  }
  if (existingRef.value !== null) {
    return toClubId(existingRef.value.internalId);
  }

  // 2. Bridge by logo, then name, against clubs the deep crawl already discovered.
  const bridgeMatch = await findClubBridgeMatch(deps, name, logoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }
  if (bridgeMatch.value === null) {
    // No match anywhere: never create (admin pseudo-clubs land here every run).
    return ok(null);
  }

  const clubId = bridgeMatch.value;

  // A club row can hold at most one `dribl`-source ref; if a second source id bridges to the same
  // row (Dribl duplicate), treat it as unresolvable rather than racing the unique constraint.
  const existingBridge = await deps.findExternalRefByInternalId(
    externalRefEntityTypeValue.club,
    clubId,
    sourceValue.dribl,
  );
  if (!existingBridge.ok) {
    return existingBridge;
  }
  if (existingBridge.value !== null) {
    return ok(null);
  }

  // Persist the bridge so future runs hit step 1 directly, and so ADR 0004's "original Dribl URL
  // retained on the external_ref" requirement is satisfied for this club's logo.
  const refUpserted = await deps.upsertExternalRef({
    id: generateId("externalRef"),
    entityType: externalRefEntityTypeValue.club,
    internalId: clubId,
    source: sourceValue.dribl,
    sourceId,
    sourceUrl: logoUrl,
  });
  if (!refUpserted.ok) {
    return refUpserted;
  }

  return ok(clubId);
}
