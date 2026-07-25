// Persists one league's deep crawl (0012): maps each raw fixture/table-entry response to domain
// via the local Dribl mappers, then upserts via the existing fixture/table-entry entity
// resolution (resolveFixtureEntities/resolveTableEntryEntities — the same services the catalog
// crawl uses for table entries). Sequential, aborting on the first `err`: every step here is
// idempotent, so a partial run is safe to retry on the next crawl rather than persisting a
// half-mapped league silently.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";
import type { DriblFixturesApiResponse } from "./external/driblFixture.ts";
import type { DriblTableApiResponse } from "./external/driblTableEntry.ts";
import { mapDriblFixture } from "./mappers/mapDriblFixture.ts";
import { mapDriblTableEntry } from "./mappers/mapDriblTableEntry.ts";
import type { DeepCrawlLeagueContext } from "./driblLeagueIdResolver.ts";
import { resolveFixtureEntities } from "./fixtureEntityResolver.ts";
import { resolveTableEntryEntities } from "./tableEntryEntityResolver.ts";

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
