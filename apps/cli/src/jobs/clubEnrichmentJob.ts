// Club enrichment job (0012): fetches rich club detail (grounds/colours/store) from Dribl's
// clubs/{id} endpoint for every listed club, bridge-matches each to a club row the deep crawl
// already discovered (never creates), mirrors its logo to R2, and writes the curated fields.
//
// This is transport glue (AGENTS.md): it constructs the real browser session, DB client, R2
// clients and downloadImage implementation, then delegates crawling and persistence to
// crawlClubEnrichment / persistClubEnrichment.

import { err, ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import { createR2AssetStorage, type AssetStorageConfig } from "../crawlers/dribl/assetStorage.ts";
import { openBrowserSession } from "../crawlers/dribl/browserSession.ts";
import { crawlClubEnrichment } from "../crawlers/dribl/clubEnrichmentCrawler.ts";
import { createEntityResolutionDeps } from "../crawlers/dribl/entityResolutionDeps.ts";
import { logClubEnrichmentDryRun } from "../crawlers/dribl/clubEnrichmentDryRunLogger.ts";
import type { DownloadedImage } from "../crawlers/dribl/clubLogoMirror.ts";
import { persistClubEnrichment } from "../crawlers/dribl/clubEnrichmentPersistence.ts";
import { createR2RawStorage, type RawStorageConfig } from "../crawlers/dribl/rawStorage.ts";

export type RunClubEnrichmentJobInput = {
  logger: Logger;
  databaseUrl: string;
  driblSiteUrl: string;
  browserWsEndpoint?: string;
  tenantHost: string;
  tenantSlug: string;
  dryRun: boolean;
  rawStorageConfig: RawStorageConfig;
  assetStorageConfig: AssetStorageConfig;
  publicAssetsBaseUrl: string;
};

/** Dribl's image CDN is reachable via a plain fetch — confirmed live, no Cloudflare-clearance
 * dance needed (unlike mc-api.dribl.com). */
async function downloadImage(url: string): Promise<Result<DownloadedImage>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return err({ message: `Failed to download image ${url}: HTTP ${response.status}` });
    }
    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    return ok({ bytes, contentType });
  } catch (cause) {
    return err({ message: `Failed to download image ${url}`, cause });
  }
}

export async function runClubEnrichmentJob(
  input: RunClubEnrichmentJobInput,
): Promise<Result<void>> {
  const {
    logger,
    databaseUrl,
    driblSiteUrl,
    browserWsEndpoint,
    tenantHost,
    tenantSlug,
    dryRun,
    rawStorageConfig,
    assetStorageConfig,
    publicAssetsBaseUrl,
  } = input;

  const sessionResult = await openBrowserSession({ driblSiteUrl, browserWsEndpoint });
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const { page, close } = sessionResult.value;

  try {
    const rawStorage = createR2RawStorage(rawStorageConfig);
    const crawlRunId = crypto.randomUUID();

    // Dry run: crawl (still stages raw responses to R2) and log, no DB writes or logo uploads.
    if (dryRun) {
      const crawlResult = await crawlClubEnrichment({
        page,
        rawStorage,
        logger,
        tenantHost,
        tenantSlug,
        crawlRunId,
      });
      if (!crawlResult.ok) {
        return crawlResult;
      }
      logClubEnrichmentDryRun(logger, crawlResult.value);
      return ok(undefined);
    }

    // Persist each club as it's crawled so a DB failure surfaces early and clubs persisted
    // before it stay committed, rather than crawling everything up front and writing at the end.
    const deps = createEntityResolutionDeps(createDbClient(databaseUrl));
    const assetStorage = createR2AssetStorage(assetStorageConfig);

    let updated = 0;
    let skipped = 0;

    const crawlResult = await crawlClubEnrichment({
      page,
      rawStorage,
      logger,
      tenantHost,
      tenantSlug,
      crawlRunId,
      onClub: async (club) => {
        const persisted = await persistClubEnrichment({
          deps,
          assetStorage,
          downloadImage,
          publicAssetsBaseUrl,
          logger,
          club,
        });
        if (persisted.ok) {
          if (persisted.value === "updated") {
            updated += 1;
          } else {
            skipped += 1;
          }
        }
        return persisted;
      },
    });
    if (!crawlResult.ok) {
      return crawlResult;
    }

    logger.info("clubenrichment.result", "club enrichment complete", {
      listed: crawlResult.value.length,
      updated,
      skipped,
    });
    return ok(undefined);
  } finally {
    await close();
  }
}
