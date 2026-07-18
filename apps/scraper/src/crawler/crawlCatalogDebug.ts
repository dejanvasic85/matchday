// Debug catalog crawl (0012): resolves the tenant + season, then walks the *first* competition
// and its *first* league only, printing the league's table (teams + club info). A cheap way to
// see the catalog crawl's shape end-to-end before the real all-competitions/all-leagues job and
// its DB upserts land in a later slice.

import {
  driblTableApiResponseSchema,
  err,
  mapDriblTableEntry,
  ok,
  type Logger,
  type MappedTableEntry,
  type Result,
} from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { buildDriblApiUrl } from "./buildDriblApiUrl.ts";
import { listCompetitions, listLeagues, listSeasons, resolveTenantId } from "./listDriblCatalog.ts";

export type CrawlCatalogDebugInput = {
  page: FetchPage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
};

export type CatalogDebugResult = {
  competitionName: string;
  leagueName: string;
  seasonName: string;
  tableEntries: MappedTableEntry[];
};

export async function crawlCatalogDebug(
  input: CrawlCatalogDebugInput,
): Promise<Result<CatalogDebugResult>> {
  const { page, logger, tenantHost, tenantSlug, seasonYear } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  const tenantId = tenantResult.value;
  logger.info("catalog.debug.tenant", "resolved tenant", { tenantId });

  const seasonsResult = await listSeasons(page, tenantId);
  if (!seasonsResult.ok) {
    return seasonsResult;
  }
  const season = seasonsResult.value.find((item) => item.attributes.name === seasonYear);
  if (season === undefined) {
    return err({ message: `No season found matching "${seasonYear}"` });
  }

  const competitionsResult = await listCompetitions(page, tenantId);
  if (!competitionsResult.ok) {
    return competitionsResult;
  }
  const [firstCompetition] = competitionsResult.value;
  if (firstCompetition === undefined) {
    return err({ message: `No competitions found for season "${seasonYear}"` });
  }
  logger.info("catalog.debug.competition", "selected first competition", {
    name: firstCompetition.attributes.name,
    total: competitionsResult.value.length,
  });

  const leaguesResult = await listLeagues(page, tenantId, firstCompetition.id);
  if (!leaguesResult.ok) {
    return leaguesResult;
  }
  const [firstLeague] = leaguesResult.value;
  if (firstLeague === undefined) {
    return err({
      message: `No leagues found for competition "${firstCompetition.attributes.name}"`,
    });
  }
  logger.info("catalog.debug.league", "selected first league", {
    name: firstLeague.attributes.name,
    total: leaguesResult.value.length,
  });

  const tableUrl = buildDriblApiUrl("ladders", {
    season: season.id,
    competition: firstCompetition.id,
    league: firstLeague.id,
    tenant: tenantId,
  });
  const tableFetched = await browserFetch(page, tableUrl);
  if (!tableFetched.ok) {
    return tableFetched;
  }

  const tableParsed = driblTableApiResponseSchema.safeParse(tableFetched.value);
  if (!tableParsed.success) {
    return err({ message: "Failed to validate table response", cause: tableParsed.error });
  }

  const tableEntries = tableParsed.data.data.map(mapDriblTableEntry);
  logger.info("catalog.debug.table", "fetched league table", { entries: tableEntries.length });

  return ok({
    competitionName: firstCompetition.attributes.name,
    leagueName: firstLeague.attributes.name,
    seasonName: season.attributes.name,
    tableEntries,
  });
}
