// Clubs-sync job (service): full `api/list/clubs` crawl -> upsert the Dribl club record. Per 0012
// this is *enrichment*, not crawl-path identity: the competition crawl owns club creation (keyed on
// the ladder `club_code`), while clubs-sync attaches the Dribl club record (grounds/colours/address/
// socials) plus a `(source="dribl", sourceId=<dribl club id>)` ref. It resolves an existing club in
// this order: (1) the `dribl` ref (idempotent re-scrape), (2) a logo match onto a club already known
// via `club_code`, (3) create. It never creates a competing row for a club that logo-matches an
// existing one. Pure and dependency-injected (AGENTS.md): the CLI threads in the real page / R2 / DB
// collaborators; tests pass fakes.
//
// Logo mirroring to R2 is deliberately out of scope here (todo.md scopes it to the competition
// crawl); the Dribl `logoUrl` is stored as-is.

import {
  driblClubsApiResponseSchema,
  driblTenantResponseSchema,
  err,
  externalRefEntityTypeValue,
  generateId,
  mapDriblClub,
  ok,
  parseId,
  sourceValue,
  type ClubId,
  type Logger,
  type Result,
} from "@matchday/domain";
import { browserFetch, type FetchPage } from "../crawler/browserFetch.ts";
import { buildDriblListApiUrl, buildDriblTenantApiUrl } from "../crawler/buildDriblApiUrl.ts";
import type { EntityResolutionDeps } from "../crawler/entityResolutionDeps.ts";
import type { RawStorage } from "../crawler/rawStorage.ts";

export type ClubsSyncDeps = {
  page: FetchPage;
  rawStorage: RawStorage;
  resolution: Pick<
    EntityResolutionDeps,
    "findExternalRef" | "findClubByLogoUrl" | "upsertClub" | "upsertExternalRef"
  >;
  logger: Logger;
  tenantSlug: string;
  driblSiteHost: string;
  crawlRunId: string;
};

export type ClubsSyncSummary = {
  total: number;
  synced: number;
  failed: number;
};

const clubsSyncEvent = "crawl.clubs" as const;

/** R2 key for the raw clubs response of a run (0004 grouping so the 7-day rule expires it cleanly). */
export function buildRawClubsKey(crawlRunId: string): string {
  return `raw/clubs/${crawlRunId}/clubs.json`;
}

async function resolveTenantId(deps: ClubsSyncDeps): Promise<Result<string>> {
  const url = buildDriblTenantApiUrl(deps.driblSiteHost, deps.tenantSlug);
  const fetched = await browserFetch(deps.page, url);
  if (!fetched.ok) {
    return fetched;
  }
  const parsed = driblTenantResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({ message: "Dribl tenant response failed validation", cause: parsed.error });
  }
  return ok(parsed.data.data.id);
}

function toClubId(id: string): Result<ClubId> {
  const clubId = parseId(id, "club");
  if (clubId === undefined) {
    return err({ message: `Club ref id "${id}" doesn't have the expected "clb_" prefix` });
  }
  return ok(clubId);
}

/**
 * Resolve the internal club id to write to, per 0012's order: (1) an existing `dribl` ref (idempotent
 * re-scrape), (2) a logo match onto a club already created via `club_code` — attach here rather than
 * duplicate, (3) a freshly generated id for a genuinely new club.
 */
async function resolveClubId(
  deps: ClubsSyncDeps,
  mapped: ReturnType<typeof mapDriblClub>,
): Promise<Result<ClubId>> {
  const byRef = await deps.resolution.findExternalRef(sourceValue.dribl, mapped.sourceId);
  if (!byRef.ok) {
    return byRef;
  }
  if (byRef.value !== null) {
    return toClubId(byRef.value.internalId);
  }

  if (mapped.logoUrl !== null) {
    const byLogo = await deps.resolution.findClubByLogoUrl(mapped.logoUrl);
    if (!byLogo.ok) {
      return byLogo;
    }
    if (byLogo.value !== null) {
      return toClubId(byLogo.value.id);
    }
  }

  return ok(generateId("club"));
}

async function syncOneClub(
  deps: ClubsSyncDeps,
  mapped: ReturnType<typeof mapDriblClub>,
): Promise<Result<void>> {
  const resolved = await resolveClubId(deps, mapped);
  if (!resolved.ok) {
    return resolved;
  }
  const internalId = resolved.value;

  const club = await deps.resolution.upsertClub({
    id: internalId,
    name: mapped.name,
    displayName: mapped.displayName,
    logoUrl: mapped.logoUrl,
    email: mapped.email,
    website: mapped.website,
    address: mapped.address,
    socials: mapped.socials,
  });
  if (!club.ok) {
    return club;
  }

  const ref = await deps.resolution.upsertExternalRef({
    id: generateId("externalRef"),
    entityType: externalRefEntityTypeValue.club,
    internalId: club.value.id,
    source: sourceValue.dribl,
    sourceId: mapped.sourceId,
    sourceUrl: null,
  });
  if (!ref.ok) {
    return ref;
  }

  return ok(undefined);
}

export async function runClubsSync(deps: ClubsSyncDeps): Promise<Result<ClubsSyncSummary>> {
  const tenantId = await resolveTenantId(deps);
  if (!tenantId.ok) {
    return tenantId;
  }

  const url = buildDriblListApiUrl("list/clubs", tenantId.value);
  const fetched = await browserFetch(deps.page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblClubsApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({ message: "Dribl clubs response failed validation", cause: parsed.error });
  }

  const staged = await deps.rawStorage.putJson(buildRawClubsKey(deps.crawlRunId), fetched.value);
  if (!staged.ok) {
    return staged;
  }

  const clubs = parsed.data.data;
  deps.logger.info(clubsSyncEvent, "clubs fetched", { count: clubs.length });

  let synced = 0;
  let failed = 0;
  for (const raw of clubs) {
    const result = await syncOneClub(deps, mapDriblClub(raw));
    if (result.ok) {
      synced += 1;
    } else {
      failed += 1;
      deps.logger.error(clubsSyncEvent, "club sync failed", {
        sourceId: raw.id,
        error: result.error.message,
      });
    }
  }

  const summary: ClubsSyncSummary = { total: clubs.length, synced, failed };
  deps.logger.info(clubsSyncEvent, "clubs sync complete", summary);
  return ok(summary);
}
