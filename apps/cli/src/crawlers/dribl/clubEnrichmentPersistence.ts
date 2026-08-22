// Persists one crawled club: bridge-matches to an existing row (never creates, ADR 0012), mirrors
// its logo to R2, writes curated fields. No match (admin pseudo-clubs) is skipped, not a failure.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { AssetStorage } from "#storage/assetStorage.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import type { MappedClubDetail } from "#crawlers/dribl/mappers/mapDriblClubDetail.ts";
import { mirrorClubLogo, type DownloadedImage } from "#storage/clubLogoMirror.ts";
import { resolveClubForEnrichment } from "#crawlers/dribl/clubEnrichmentResolver.ts";

export type PersistClubEnrichmentInput = {
  deps: Pick<
    EntityResolutionDeps,
    | "findClubByExternalRefSourceUrl"
    | "findClubByLogoUrl"
    | "findClubByName"
    | "findExternalRef"
    | "findExternalRefByInternalId"
    | "upsertExternalRef"
    | "getClubById"
    | "updateClubEnrichmentFields"
  >;
  assetStorage: AssetStorage;
  downloadImage: (url: string) => Promise<Result<DownloadedImage>>;
  publicAssetsBaseUrl: string;
  logger: Logger;
  club: MappedClubDetail;
};

export type PersistClubEnrichmentOutcome = "updated" | "skipped";

export async function persistClubEnrichment(
  input: PersistClubEnrichmentInput,
): Promise<Result<PersistClubEnrichmentOutcome>> {
  const { deps, assetStorage, downloadImage, publicAssetsBaseUrl, logger, club } = input;

  const resolved = await resolveClubForEnrichment({
    deps,
    sourceId: club.sourceId,
    name: club.name,
    logoUrl: club.logoUrl,
  });
  if (!resolved.ok) {
    return resolved;
  }
  if (resolved.value === null) {
    logger.debug("clubenrichment.skip", "no matching club row, skipping", {
      name: club.name,
      sourceId: club.sourceId,
    });
    return ok("skipped");
  }
  const clubId = resolved.value;

  const currentRow = await deps.getClubById(clubId);
  if (!currentRow.ok) {
    return currentRow;
  }

  const mirrored = await mirrorClubLogo({
    assetStorage,
    downloadImage,
    clubId,
    currentLogoUrl: currentRow.value?.logoUrl ?? null,
    sourceLogoUrl: club.logoUrl,
    publicAssetsBaseUrl,
  });
  if (!mirrored.ok) {
    return mirrored;
  }

  // A transient/incomplete clubs/{id} response shouldn't regress previously-curated data — keep
  // the current value for any field this run came back null for.
  const current = currentRow.value;
  const updated = await deps.updateClubEnrichmentFields(clubId, {
    logoUrl: mirrored.value ?? current?.logoUrl ?? null,
    email: club.email ?? current?.email ?? null,
    website: club.website ?? current?.website ?? null,
    address: club.address ?? current?.address ?? null,
    socials: club.socials ?? current?.socials ?? null,
    grounds: club.grounds ?? current?.grounds ?? null,
    color: club.color ?? current?.color ?? null,
    accent: club.accent ?? current?.accent ?? null,
    store: club.store ?? current?.store ?? null,
  });
  if (!updated.ok) {
    return updated;
  }
  if (updated.value === null) {
    logger.warn("clubenrichment.raceMissing", "club vanished before enrichment write", { clubId });
    return ok("skipped");
  }

  logger.info("clubenrichment.updated", "club enriched", { clubId, name: club.name });
  return ok("updated");
}
