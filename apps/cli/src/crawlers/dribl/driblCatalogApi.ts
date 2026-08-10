// Source-wide catalog list calls (0012 catalog crawl): tenant -> competitions -> leagues, each
// returned in full (no name-matching) so a catalog job can enumerate everything for a season.
// Reuses the same list/* endpoints as resolveLeagueIds, but that resolver requires knowing the
// target name upfront — this module is for listing every item instead.

import { ok, serverError, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { crawlerConfigValue } from "./constants.ts";
import { driblClubsApiResponseSchema, type DriblClub } from "./external/driblClub.ts";
import {
  driblListResponseSchema,
  driblTenantResponseSchema,
  type DriblListItem,
} from "./external/driblListEndpoints.ts";

export async function resolveTenantId(
  page: FetchPage,
  tenantHost: string,
  tenantSlug: string,
): Promise<Result<string>> {
  const url = `${crawlerConfigValue.driblApiBase}/tenants?mc_link=${encodeURIComponent(tenantHost)}&slug=${encodeURIComponent(tenantSlug)}`;
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblTenantResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return serverError("Failed to validate tenant response", parsed.error);
  }
  return ok(parsed.data.data.id);
}

async function listItems(page: FetchPage, url: string): Promise<Result<DriblListItem[]>> {
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblListResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return serverError(`Failed to validate list response from ${url}`, parsed.error);
  }
  return ok(parsed.data.data);
}

export function listSeasons(page: FetchPage, tenantId: string): Promise<Result<DriblListItem[]>> {
  const url = `${crawlerConfigValue.driblApiBase}/list/seasons?disable_paging=true&tenant=${tenantId}`;
  return listItems(page, url);
}

export function listCompetitions(
  page: FetchPage,
  tenantId: string,
): Promise<Result<DriblListItem[]>> {
  const url = `${crawlerConfigValue.driblApiBase}/list/competitions?disable_paging=true&tenant=${tenantId}`;
  return listItems(page, url);
}

export function listLeagues(
  page: FetchPage,
  tenantId: string,
  competitionId: string,
): Promise<Result<DriblListItem[]>> {
  const url = `${crawlerConfigValue.driblApiBase}/list/leagues?disable_paging=true&tenant=${tenantId}&competition=${competitionId}`;
  return listItems(page, url);
}

/** Source-wide club listing (club-enrichment job): includes admin pseudo-clubs, filtered out by
 * the caller's bridge-match, not here — this module only lists everything Dribl returns. */
export async function listClubs(page: FetchPage, tenantId: string): Promise<Result<DriblClub[]>> {
  const url = `${crawlerConfigValue.driblApiBase}/list/clubs?disable_paging=true&tenant=${tenantId}`;
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblClubsApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return serverError(`Failed to validate list/clubs response from ${url}`, parsed.error);
  }
  return ok(parsed.data.data);
}
