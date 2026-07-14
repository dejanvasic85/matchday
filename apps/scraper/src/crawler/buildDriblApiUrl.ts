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
