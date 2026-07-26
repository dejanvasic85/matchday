// Crawls club detail for the club-enrichment job (0012): source-wide, DB-free — lists every
// Dribl club for the tenant, fetches `clubs/{id}` detail for each (staged to R2 before mapping,
// per 0004), and maps to domain. Includes admin pseudo-clubs; the persist phase's bridge-match
// filters those out (never creates a row for them), not this crawl phase.
//
// An optional `onClub` callback is invoked with each mapped club as it's crawled, mirroring
// crawlCatalog's `onLeague` — lets the job persist as it goes rather than buffering everything.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { FetchPage } from "./browserFetch.ts";
import { fetchClubDetail } from "./clubDetailFetcher.ts";
import { listClubs, resolveTenantId } from "./driblCatalogApi.ts";
import { mapDriblClubDetail, type MappedClubDetail } from "./mappers/mapDriblClubDetail.ts";
import type { RawStorage } from "../../storage/rawStorage.ts";
import { buildRawClubEnrichmentKey } from "./rawStorageKey.ts";

export type CrawlClubEnrichmentInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  crawlRunId: string;
  /** Invoked with each club as it's crawled; return `err` to abort the crawl. */
  onClub?: (club: MappedClubDetail) => Promise<Result<unknown>>;
};

export async function crawlClubEnrichment(
  input: CrawlClubEnrichmentInput,
): Promise<Result<MappedClubDetail[]>> {
  const { page, rawStorage, logger, tenantHost, tenantSlug, crawlRunId, onClub } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  const tenantId = tenantResult.value;

  const listResult = await listClubs(page, tenantId);
  if (!listResult.ok) {
    return listResult;
  }
  logger.info("clubenrichment.list", "listed clubs", { total: listResult.value.length });

  const results: MappedClubDetail[] = [];

  for (const listed of listResult.value) {
    const detailResult = await fetchClubDetail(page, tenantId, listed.id);
    if (!detailResult.ok) {
      return detailResult;
    }

    const key = buildRawClubEnrichmentKey(crawlRunId, listed.id);
    const staged = await rawStorage.putJson(key, detailResult.value);
    if (!staged.ok) {
      return staged;
    }

    const mapped = mapDriblClubDetail(detailResult.value.data);
    results.push(mapped);

    if (onClub !== undefined) {
      const persisted = await onClub(mapped);
      if (!persisted.ok) {
        return persisted;
      }
    }
  }

  return ok(results);
}
