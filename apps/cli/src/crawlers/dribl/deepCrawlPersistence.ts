// Persists one league's deep crawl (0012). Sequential, aborting on the first `err`: every step is
// idempotent, so a partial run is safe to retry rather than persisting a half-mapped league.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import type { DriblFixturesApiResponse } from "#crawlers/dribl/external/driblFixture.ts";
import type { DriblTableApiResponse } from "#crawlers/dribl/external/driblTableEntry.ts";
import { mapDriblFixture } from "#crawlers/dribl/mappers/mapDriblFixture.ts";
import { mapDriblTableEntry } from "#crawlers/dribl/mappers/mapDriblTableEntry.ts";
import type { DeepCrawlLeagueContext } from "#crawlers/dribl/driblLeagueIdResolver.ts";
import { resolveFixtureEntities } from "#crawlers/dribl/fixtureEntityResolver.ts";
import { resolveTableEntryEntities } from "#crawlers/dribl/tableEntryEntityResolver.ts";

export type DeepCrawlPersistInput = {
  deps: EntityResolutionDeps;
  logger: Logger;
  context: DeepCrawlLeagueContext;
  fixtureResponses: DriblFixturesApiResponse[];
  tableResponse: DriblTableApiResponse | undefined;
};

export type DeepCrawlPersistSummary = {
  fixtures: number;
  tableEntries: number;
};

export async function deepCrawlPersist(
  input: DeepCrawlPersistInput,
): Promise<Result<DeepCrawlPersistSummary>> {
  const { deps, logger, context, fixtureResponses, tableResponse } = input;

  let fixtureCount = 0;
  for (const response of fixtureResponses) {
    for (const fixture of response.data) {
      const mapped = mapDriblFixture(fixture);
      const result = await resolveFixtureEntities(deps, logger, mapped, context);
      if (!result.ok) {
        return result;
      }
      fixtureCount += 1;
    }
  }

  let tableEntryCount = 0;
  for (const entry of tableResponse?.data ?? []) {
    const mapped = mapDriblTableEntry(entry);
    const result = await resolveTableEntryEntities(deps, mapped, context);
    if (!result.ok) {
      return result;
    }
    tableEntryCount += 1;
  }

  logger.info("deepcrawl.persist.league", "persisted league", {
    leagueId: context.leagueId,
    fixtures: fixtureCount,
    tableEntries: tableEntryCount,
  });

  return ok({ fixtures: fixtureCount, tableEntries: tableEntryCount });
}
