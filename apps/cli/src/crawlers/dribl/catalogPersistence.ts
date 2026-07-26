// Persists a catalog crawl (0012): turns each crawled league (competition/season/league source
// names+ids plus its table entries) into upserted rows. Competition, season and league each carry
// a stable Dribl source id, so they're resolved via external_ref (find-or-create the internal id,
// upsert the row every run); their internal ids then form the context each table entry's club +
// team + table_entry row is resolved against (resolveTableEntryEntities).
//
// `persistLeague` persists one league; the crawl job calls it as each league is crawled (rather
// than crawling the whole catalog into memory and persisting at the end) so a DB failure surfaces
// early and every league persisted before it stays committed. `persistCatalog` persists a batch by
// calling `persistLeague` in a loop — used where the leagues are already in hand (e.g. tests).
//
// One league's failure aborts the run and surfaces as `err` — an incomplete catalog is worse than
// a loud failure the scheduler can retry (every step is idempotent, so a retry is safe).

import { externalRefEntityTypeValue, ok, type Logger, type Result } from "@matchday/domain";
import type { CrawlCatalogLeagueResult } from "./catalogCrawler.ts";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "./externalRefEntityResolver.ts";
import { resolveTableEntryEntities } from "./tableEntryEntityResolver.ts";

export type PersistLeagueInput = {
  deps: EntityResolutionDeps;
  logger: Logger;
  league: CrawlCatalogLeagueResult;
};

export type PersistCatalogInput = {
  deps: EntityResolutionDeps;
  logger: Logger;
  leagues: CrawlCatalogLeagueResult[];
};

export type PersistLeagueSummary = {
  tableEntries: number;
};

export type PersistCatalogSummary = {
  leagues: number;
  tableEntries: number;
};

export async function persistLeague(
  input: PersistLeagueInput,
): Promise<Result<PersistLeagueSummary>> {
  const { deps, logger, league } = input;

  const competitionResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.competition,
    sourceId: league.competitionSourceId,
    upsertEntity: (id) => deps.upsertCompetition({ id, name: league.competitionName }),
  });
  if (!competitionResult.ok) {
    return competitionResult;
  }

  const seasonResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.season,
    sourceId: league.seasonSourceId,
    upsertEntity: (id) => deps.upsertSeason({ id, name: league.seasonName }),
  });
  if (!seasonResult.ok) {
    return seasonResult;
  }

  const leagueResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.league,
    sourceId: league.leagueSourceId,
    upsertEntity: (id) =>
      deps.upsertLeague({
        id,
        name: league.leagueName,
        competitionId: competitionResult.value,
        seasonId: seasonResult.value,
      }),
  });
  if (!leagueResult.ok) {
    return leagueResult;
  }

  const context = {
    competitionId: competitionResult.value,
    seasonId: seasonResult.value,
    leagueId: leagueResult.value,
  };

  for (const entry of league.tableEntries) {
    const entryResult = await resolveTableEntryEntities(deps, entry, context);
    if (!entryResult.ok) {
      return entryResult;
    }
  }

  logger.info("catalog.persist.league", "persisted league", {
    competition: league.competitionName,
    league: league.leagueName,
    leagueId: leagueResult.value,
    tableEntries: league.tableEntries.length,
  });

  return ok({ tableEntries: league.tableEntries.length });
}

export async function persistCatalog(
  input: PersistCatalogInput,
): Promise<Result<PersistCatalogSummary>> {
  const { deps, logger, leagues } = input;

  let tableEntryCount = 0;

  for (const league of leagues) {
    const result = await persistLeague({ deps, logger, league });
    if (!result.ok) {
      return result;
    }
    tableEntryCount += result.value.tableEntries;
  }

  return ok({ leagues: leagues.length, tableEntries: tableEntryCount });
}
