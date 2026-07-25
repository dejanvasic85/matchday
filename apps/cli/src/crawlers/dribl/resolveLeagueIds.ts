// Resolves the opaque hashed IDs (season/competition/league/tenant) Dribl's fixtures/ladders
// endpoints require from human-readable names, via the tenant + list endpoints. Results are
// cached by league name (dribl-crawling skill) so repeat crawls skip re-resolution; a regrade
// changes the league name, misses the cache, and re-resolves automatically.

import { driblListResponseSchema, err, ok, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import type { DriblLeagueIds } from "./buildDriblApiUrl.ts";
import { crawlerConfigValue } from "./constants.ts";
import type { IdCacheStore } from "./idCache.ts";
import { resolveTenantId } from "./listDriblCatalog.ts";

const removedLeaguePrefix = "(Removed)";

export type ResolveLeagueIdsInput = {
  page: FetchPage;
  cacheStore: IdCacheStore;
  logger: Logger;
  /** The tenant's public Dribl host, e.g. "fv.dribl.com" — passed as the `mc_link` param. */
  tenantHost: string;
  tenantSlug: string;
  leagueName: string;
  competitionName: string;
  seasonYear: string;
};

async function resolveListId(
  page: FetchPage,
  url: string,
  matchName: string,
  skipRemoved: boolean,
): Promise<Result<string>> {
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblListResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({ message: `Failed to validate list response from ${url}`, cause: parsed.error });
  }

  const match = parsed.data.data.find((item) => {
    if (skipRemoved && item.attributes.name.startsWith(removedLeaguePrefix)) {
      return false;
    }
    return item.attributes.name === matchName;
  });

  if (match === undefined) {
    return err({ message: `No match for "${matchName}" at ${url}` });
  }
  return ok(match.id);
}

export async function resolveLeagueIds(
  input: ResolveLeagueIdsInput,
): Promise<Result<DriblLeagueIds>> {
  const {
    page,
    cacheStore,
    logger,
    tenantHost,
    tenantSlug,
    leagueName,
    competitionName,
    seasonYear,
  } = input;

  const cache = await cacheStore.load();
  const cached = cache.leagues[leagueName];
  if (cached !== undefined) {
    logger.debug("crawl.resolveLeagueIds", "cache hit", { leagueName });
    return ok(cached);
  }

  const apiBase = crawlerConfigValue.driblApiBase;

  const tenantResult =
    cache.tenant !== undefined
      ? ok(cache.tenant)
      : await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  const tenantId = tenantResult.value;

  // Save the tenant id as soon as it's known, before the (more failure-prone) list lookups
  // below, so a season/competition/league failure doesn't force tenant re-resolution too.
  if (cache.tenant === undefined) {
    await cacheStore.save({ tenant: tenantId, leagues: cache.leagues });
  }

  const seasonResult = await resolveListId(
    page,
    `${apiBase}/list/seasons?disable_paging=true&tenant=${tenantId}`,
    seasonYear,
    false,
  );
  if (!seasonResult.ok) {
    return seasonResult;
  }

  const competitionResult = await resolveListId(
    page,
    `${apiBase}/list/competitions?disable_paging=true&tenant=${tenantId}`,
    competitionName,
    false,
  );
  if (!competitionResult.ok) {
    return competitionResult;
  }

  const leagueResult = await resolveListId(
    page,
    `${apiBase}/list/leagues?disable_paging=true&tenant=${tenantId}&competition=${competitionResult.value}`,
    leagueName,
    true,
  );
  if (!leagueResult.ok) {
    return leagueResult;
  }

  const ids: DriblLeagueIds = {
    tenant: tenantId,
    season: seasonResult.value,
    competition: competitionResult.value,
    league: leagueResult.value,
  };

  await cacheStore.save({
    tenant: tenantId,
    leagues: { ...cache.leagues, [leagueName]: ids },
  });
  logger.info("crawl.resolveLeagueIds", "resolved league ids", { leagueName, ids });

  return ok(ids);
}
