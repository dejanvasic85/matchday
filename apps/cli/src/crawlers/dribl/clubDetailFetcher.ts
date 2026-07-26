// Fetches one club's rich detail (grounds/colours/store, per the club-enrichment job) from
// Dribl's `clubs/{id}` endpoint. Unlike `list/clubs`, this returns a single object under `data`,
// not an array (confirmed against a live response).

import { err, ok, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { crawlerConfigValue } from "./constants.ts";
import {
  driblClubDetailApiResponseSchema,
  type DriblClubDetailApiResponse,
} from "./external/driblClub.ts";

export async function fetchClubDetail(
  page: FetchPage,
  tenantId: string,
  clubSourceId: string,
): Promise<Result<DriblClubDetailApiResponse>> {
  const url = `${crawlerConfigValue.driblApiBase}/clubs/${clubSourceId}?tenant=${tenantId}`;
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblClubDetailApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({
      message: `Failed to validate clubs/${clubSourceId} response`,
      cause: parsed.error,
    });
  }
  return ok(parsed.data);
}
