import { crawlerConfigValue } from "./constants.ts";

export type DriblLeagueIds = {
  season: string;
  competition: string;
  league: string;
  tenant: string;
};

export function buildDriblApiUrl(
  endpoint: string,
  ids: DriblLeagueIds,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    season: ids.season,
    competition: ids.competition,
    league: ids.league,
    tenant: ids.tenant,
    timezone: crawlerConfigValue.defaultTimezone,
    ...extra,
  });
  return `${crawlerConfigValue.driblApiBase}/${endpoint}?${params.toString()}`;
}

/**
 * `api/tenants` resolves a tenant slug to its opaque tenant id (dribl-crawling skill). Unlike the
 * league-keyed endpoints it takes `mc_link` (the site host) + `slug`, and returns a single object.
 */
export function buildDriblTenantApiUrl(siteHost: string, slug: string): string {
  const params = new URLSearchParams({ mc_link: siteHost, slug });
  return `${crawlerConfigValue.driblApiBase}/tenants?${params.toString()}`;
}

/**
 * `api/list/*` endpoints (e.g. `list/clubs`) key only on `tenant` (+ optional extras like
 * `competition` for leagues); they don't take season/competition/league like the fixtures API.
 */
export function buildDriblListApiUrl(
  endpoint: string,
  tenant: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ tenant, disable_paging: "true", ...extra });
  return `${crawlerConfigValue.driblApiBase}/${endpoint}?${params.toString()}`;
}
