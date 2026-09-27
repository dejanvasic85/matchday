// Persists one Coastal club's logo: resolves the club row the catalog crawl created (never
// creates), mirrors the logo to R2, and writes the logo plus the club's two crest colours.

import { ok, parseId, sourceValue, type Logger, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import type { CoastalClub } from "#crawlers/coastal/roster.ts";
import { coastalClubSourceId } from "#crawlers/coastal/sourceIds.ts";
import type { AssetStorage } from "#storage/assetStorage.ts";
import { mirrorLogoBytes, type DownloadedImage } from "#storage/clubLogoMirror.ts";

export type PersistCoastalClubEnrichmentInput = {
  deps: Pick<
    EntityResolutionDeps,
    "findExternalRef" | "getClubById" | "updateClubEnrichmentFields"
  >;
  assetStorage: AssetStorage;
  loadLogo: (club: CoastalClub) => Promise<Result<DownloadedImage>>;
  publicAssetsBaseUrl: string;
  logger: Logger;
  club: CoastalClub;
};

export type CoastalClubEnrichmentOutcome = "updated" | "skipped";

export async function persistCoastalClubEnrichment(
  input: PersistCoastalClubEnrichmentInput,
): Promise<Result<CoastalClubEnrichmentOutcome>> {
  const { deps, assetStorage, loadLogo, publicAssetsBaseUrl, logger, club } = input;

  const ref = await deps.findExternalRef(sourceValue.coastal, coastalClubSourceId(club));
  if (!ref.ok) {
    return ref;
  }
  if (ref.value === null) {
    logger.debug("clubenrichment.skip", "no coastal club ref, skipping", { key: club.key });
    return ok("skipped");
  }

  const clubId = parseId(ref.value.internalId, "club");
  if (clubId === undefined) {
    logger.warn("clubenrichment.badRef", "coastal club ref is not a club id", {
      key: club.key,
      internalId: ref.value.internalId,
    });
    return ok("skipped");
  }

  const currentRow = await deps.getClubById(clubId);
  if (!currentRow.ok) {
    return currentRow;
  }
  if (currentRow.value === null) {
    logger.debug("clubenrichment.skip", "coastal club row missing, skipping", {
      key: club.key,
      clubId,
    });
    return ok("skipped");
  }

  const image = await loadLogo(club);
  if (!image.ok) {
    return image;
  }

  const mirrored = await mirrorLogoBytes({
    assetStorage,
    clubId,
    currentLogoUrl: currentRow.value.logoUrl,
    image: image.value,
    publicAssetsBaseUrl,
  });
  if (!mirrored.ok) {
    return mirrored;
  }

  // The crest owns the logo and colours; every other field stays as the catalog crawl left it.
  const current = currentRow.value;
  const updated = await deps.updateClubEnrichmentFields(clubId, {
    logoUrl: mirrored.value,
    color: club.color,
    accent: club.accent,
    email: current.email,
    website: current.website,
    address: current.address,
    socials: current.socials,
    grounds: current.grounds,
    store: current.store,
  });
  if (!updated.ok) {
    return updated;
  }
  if (updated.value === null) {
    logger.warn("clubenrichment.raceMissing", "club vanished before enrichment write", { clubId });
    return ok("skipped");
  }

  logger.info("clubenrichment.updated", "coastal club enriched", { clubId, name: club.name });
  return ok("updated");
}
