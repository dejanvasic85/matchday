// Club enrichment job (0012): fetches rich club detail (grounds/colours/store) from the source's
// club-detail endpoint for every listed club, bridge-matches each to a club row the deep crawl
// already discovered (never creates), mirrors its logo to R2, and writes the curated fields.
//
// This is transport glue (AGENTS.md): it looks up the source's adapter, the real DB client, R2
// clients and downloadImage implementation, then delegates crawling and persistence to the
// adapter's session (source-abstraction seam, docs/todo.md Phase 3).

import { ok, serverError, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import type { CliConfig } from "../../config.ts";
import type { CrawlSource } from "../../crawlers/constants.ts";
import { createEntityResolutionDeps } from "../../crawlers/dribl/entityResolutionDeps.ts";
import { getSourceAdapter } from "../../crawlers/sourceRegistry.ts";
import { createR2AssetStorage } from "../../storage/assetStorage.ts";
import type { DownloadedImage } from "../../storage/clubLogoMirror.ts";
import { createR2RawStorage } from "../../storage/rawStorage.ts";

export type RunClubEnrichmentJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  dryRun: boolean;
};

/** Dribl's image CDN is reachable via a plain fetch — confirmed live, no Cloudflare-clearance
 * dance needed (unlike mc-api.dribl.com). A future source's adapter can inject a different
 * downloadImage if its CDN needs one. */
async function downloadImage(url: string): Promise<Result<DownloadedImage>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return serverError(`Failed to download image ${url}: HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    return ok({ bytes, contentType });
  } catch (cause) {
    return serverError(`Failed to download image ${url}`, cause);
  }
}

export async function runClubEnrichmentJob(
  input: RunClubEnrichmentJobInput,
): Promise<Result<void>> {
  const { logger, config, source, dryRun } = input;

  const adapter = getSourceAdapter(source);
  const sessionResult = await adapter.openSession(config);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  try {
    const deps = createEntityResolutionDeps(createDbClient(config.DATABASE_URL));
    const rawStorage = createR2RawStorage({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucketName: config.R2_RAW_BUCKET_NAME,
    });
    const assetStorage = createR2AssetStorage({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucketName: config.R2_BUCKET_NAME,
    });

    const result = await session.crawlClubEnrichment({
      deps,
      rawStorage,
      assetStorage,
      downloadImage,
      publicAssetsBaseUrl: config.R2_PUBLIC_ASSETS_URL,
      logger,
      dryRun,
    });
    if (!result.ok) {
      return result;
    }

    logger.info("clubenrichment.result", "club enrichment complete", {
      source,
      dryRun,
      listed: result.value.listed,
      updated: result.value.updated,
      skipped: result.value.skipped,
    });
    return ok(undefined);
  } finally {
    await session.close();
  }
}
