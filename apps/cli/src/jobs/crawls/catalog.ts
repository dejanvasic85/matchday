// Catalog crawl (0012): cheap, source-wide enumeration of competitions/leagues/teams/clubs for a
// season, upserted via `external_ref`. Populates onboarding dropdowns; runs regardless of subs.

import { ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import { createEntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";

export type RunCatalogJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  seasonYear: string;
  maxLeagues?: number;
  /** Windows the flat (competition, league) queue instead of crawling all of it — the
   * crawl-catalog.yml matrix's per-leg scope (see `mday catalog count`). */
  offset?: number;
  limit?: number;
  dryRun: boolean;
};

export async function runCatalogJob(input: RunCatalogJobInput): Promise<Result<void>> {
  const { logger, config, source, seasonYear, maxLeagues, offset, limit, dryRun } = input;
  const startedAt = Date.now();

  const adapter = getSourceAdapter(source);
  const sessionResult = await adapter.openSession(config);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  try {
    const deps = createEntityResolutionDeps(createDbClient(config.DATABASE_URL));
    const result = await session.crawlCatalog({
      deps,
      logger,
      seasonYear,
      maxLeagues,
      offset,
      limit,
      dryRun,
    });
    if (!result.ok) {
      return result;
    }

    logger.info("catalog.result", "catalog crawl complete", {
      source,
      dryRun,
      competitions: result.value.competitions,
      leagues: result.value.leagues,
      clubs: result.value.clubs,
      teams: result.value.teams,
      tableEntries: result.value.tableEntries,
      durationMs: Date.now() - startedAt,
    });
    return ok(undefined);
  } finally {
    await session.close();
  }
}
