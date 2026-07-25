// Persists one league's deep crawl (0012): maps each raw fixture/table-entry response to domain
// via the packages/domain mappers, then upserts via the existing fixture/table-entry entity
// resolution (resolveFixtureEntities/resolveTableEntryEntities — the same services the catalog
// crawl uses for table entries). Sequential, aborting on the first `err`: every step here is
// idempotent, so a partial run is safe to retry on the next crawl rather than persisting a
// half-mapped league silently.

import {
  mapDriblFixture,
  mapDriblTableEntry,
  ok,
  type DriblFixturesApiResponse,
  type DriblTableApiResponse,
  type Logger,
  type Result,
} from "@matchday/domain";
import type { DeepCrawlLeagueContext } from "./resolveDriblLeagueIds.ts";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";
import { resolveFixtureEntities } from "./resolveFixtureEntities.ts";
import { resolveTableEntryEntities } from "./resolveTableEntryEntities.ts";

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
      const result = await resolveFixtureEntities(deps, mapped, context);
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
