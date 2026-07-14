// Gitignored on-disk cache for resolved Dribl IDs, keyed by league name (dribl-crawling skill).
// On a regrade the league name changes, the cache misses, the resolver re-resolves, and the new
// IDs are cached — regrades are handled automatically.

import { promises as fs } from "node:fs";
import { z } from "zod";
import type { DriblLeagueIds } from "./buildDriblApiUrl.ts";

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

export function createFileIdCacheStore(filePath: string): IdCacheStore {
  return {
    async load() {
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        return idCacheSchema.parse(JSON.parse(raw));
      } catch {
        // Missing file (first run), corrupt JSON, or a stale shape all self-heal the same way:
        // start from empty and let resolveLeagueIds re-resolve and overwrite on next save.
        return emptyCache();
      }
    },
    async save(cache) {
      await fs.writeFile(filePath, JSON.stringify(cache, null, 2), "utf-8");
    },
  };
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
