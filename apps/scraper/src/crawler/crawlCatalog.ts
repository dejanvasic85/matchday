// Catalog crawl (0012): resolves the tenant + season, walks every competition and, for each,
// up to `maxLeagues` of its leagues (all leagues when unset), fetching each league's table
// (teams + club info). `maxLeagues` lets a caller keep the crawl cheap while iterating on the
// pipeline — e.g. `mday catalog --max-leagues 1` crawls one league per competition instead of
// the full source. Persisting the result (DB upserts) is a later slice; this returns the
// crawled data for the caller to do with as it likes.

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

export type CrawlCatalogInput = {
  page: FetchPage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
  /** Crawl at most this many leagues per competition. Unset crawls every league. */
  maxLeagues?: number;
};

export type CrawlCatalogLeagueResult = {
  competitionSourceId: string;
  competitionName: string;
  leagueSourceId: string;
  leagueName: string;
  seasonSourceId: string;
  seasonName: string;
  tableEntries: MappedTableEntry[];
};

export async function crawlCatalog(
  input: CrawlCatalogInput,
): Promise<Result<CrawlCatalogLeagueResult[]>> {
  const { page, logger, tenantHost, tenantSlug, seasonYear, maxLeagues } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  const tenantId = tenantResult.value;
  logger.info("catalog.tenant", "resolved tenant", { tenantId });

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
  logger.info("catalog.competitions", "listed competitions", {
    total: competitionsResult.value.length,
  });

  const results: CrawlCatalogLeagueResult[] = [];

  for (const competition of competitionsResult.value) {
    const leaguesResult = await listLeagues(page, tenantId, competition.id);
    if (!leaguesResult.ok) {
      return leaguesResult;
    }
    const leagues = leaguesResult.value.slice(0, maxLeagues);
    logger.info("catalog.leagues", "listed leagues for competition", {
      competition: competition.attributes.name,
      total: leaguesResult.value.length,
      crawling: leagues.length,
    });

    for (const league of leagues) {
      const tableUrl = buildDriblApiUrl("ladders", {
        season: season.id,
        competition: competition.id,
        league: league.id,
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
      logger.info("catalog.table", "fetched league table", {
        competition: competition.attributes.name,
        league: league.attributes.name,
        entries: tableEntries.length,
      });

      results.push({
        competitionSourceId: competition.id,
        competitionName: competition.attributes.name,
        leagueSourceId: league.id,
        leagueName: league.attributes.name,
        seasonSourceId: season.id,
        seasonName: season.attributes.name,
        tableEntries,
      });
    }
  }

  return ok(results);
}
