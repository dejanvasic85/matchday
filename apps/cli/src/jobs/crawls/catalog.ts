// Catalog crawl (0012): cheap, source-wide enumeration of competitions, leagues, teams and their
// clubs for a season, upserted as first-class rows with `external_ref`. Populates the onboarding
// dropdowns; runs on a schedule regardless of subscriptions.
//
// This is transport glue (AGENTS.md): it looks up the source's adapter and the real DB client,
// then delegates crawling and persistence to the adapter's session (source-abstraction seam,
// docs/todo.md Phase 3).

import { ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import type { CliConfig } from "@/src/config.ts";
import type { CrawlSource } from "@/src/crawlers/constants.ts";
import { createEntityResolutionDeps } from "@/src/crawlers/dribl/entityResolutionDeps.ts";
import { getSourceAdapter } from "@/src/crawlers/sourceRegistry.ts";

export type RunCatalogJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  seasonYear: string;
  maxLeagues?: number;
  dryRun: boolean;
};

export async function runCatalogJob(input: RunCatalogJobInput): Promise<Result<void>> {
  const { logger, config, source, seasonYear, maxLeagues, dryRun } = input;
  const startedAt = Date.now();

  const adapter = getSourceAdapter(source);
  const sessionResult = await adapter.openSession(config);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  try {
    const deps = createEntityResolutionDeps(createDbClient(config.DATABASE_URL));
    const result = await session.crawlCatalog({ deps, logger, seasonYear, maxLeagues, dryRun });
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
