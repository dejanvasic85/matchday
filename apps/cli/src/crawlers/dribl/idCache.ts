// Cache of resolved Dribl IDs, keyed by league name, for `leagueIdResolver.ts`. A regrade changes
// the name, misses the cache, and the resolver re-resolves and re-caches automatically.

import { z } from "zod";
import type { DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";

const driblLeagueIdsSchema = z.object({
  season: z.string(),
  competition: z.string(),
  league: z.string(),
  tenant: z.string(),
}) satisfies z.ZodType<DriblLeagueIds>;

const idCacheSchema = z.object({
  tenant: z.string().optional(),
  leagues: z.record(z.string(), driblLeagueIdsSchema),
});

export type IdCache = z.infer<typeof idCacheSchema>;

export type IdCacheStore = {
  load: () => Promise<IdCache>;
  save: (cache: IdCache) => Promise<void>;
};

function emptyCache(): IdCache {
  return { leagues: {} };
}

export function createInMemoryIdCacheStore(initial: IdCache = emptyCache()): IdCacheStore {
  let cache = initial;
  return {
    load: () => Promise.resolve(cache),
    save: (next) => {
      cache = next;
      return Promise.resolve();
    },
  };
}
