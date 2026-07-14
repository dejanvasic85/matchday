import type { Logger } from "@matchday/domain";
import type { FetchPage } from "./browserFetch.ts";
import { createInMemoryIdCacheStore } from "./idCache.ts";
import { resolveLeagueIds } from "./resolveLeagueIds.ts";

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeFakePage(responses: Record<string, unknown>): FetchPage {
  return {
    evaluate: async (_fn, url) => {
      const matched = Object.entries(responses).find(([key]) => url.includes(key));
      if (matched === undefined) {
        throw new Error(`No fake response registered for ${url}`);
      }
      return JSON.stringify(matched[1]) as never;
    },
  };
}

const baseResponses = {
  tenants: { data: { id: "tenant-id" } },
  "list/seasons": { data: [{ id: "season-id", attributes: { name: "2026" } }] },
  "list/competitions": {
    data: [{ id: "competition-id", attributes: { name: "FFV" } }],
  },
  "list/leagues": {
    data: [
      { id: "removed-id", attributes: { name: "(Removed) Girls U12" } },
      { id: "league-id", attributes: { name: "Girls U12" } },
    ],
  },
};

describe("resolveLeagueIds", () => {
  it("returns the cached ids without calling the page when already cached", async () => {
    const cachedIds = { season: "s", competition: "c", league: "l", tenant: "t" };
    const cacheStore = createInMemoryIdCacheStore({
      tenant: "t",
      leagues: { "Girls U12": cachedIds },
    });
    const page = makeFakePage({});

    const result = await resolveLeagueIds({
      page,
      cacheStore,
      logger: makeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      leagueName: "Girls U12",
      competitionName: "FFV",
      seasonYear: "2026",
    });

    expect(result).toEqual({ ok: true, value: cachedIds });
  });

  it("resolves via tenant + list endpoints on a cache miss, skipping removed leagues", async () => {
    const cacheStore = createInMemoryIdCacheStore();
    const page = makeFakePage(baseResponses);

    const result = await resolveLeagueIds({
      page,
      cacheStore,
      logger: makeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      leagueName: "Girls U12",
      competitionName: "FFV",
      seasonYear: "2026",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        tenant: "tenant-id",
        season: "season-id",
        competition: "competition-id",
        league: "league-id",
      },
    });
  });

  it("caches the resolved ids for subsequent lookups", async () => {
    const cacheStore = createInMemoryIdCacheStore();
    const page = makeFakePage(baseResponses);

    await resolveLeagueIds({
      page,
      cacheStore,
      logger: makeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      leagueName: "Girls U12",
      competitionName: "FFV",
      seasonYear: "2026",
    });
    const cache = await cacheStore.load();

    expect(cache.leagues["Girls U12"]).toEqual({
      tenant: "tenant-id",
      season: "season-id",
      competition: "competition-id",
      league: "league-id",
    });
  });

  it("returns err when no league matches the given name", async () => {
    const cacheStore = createInMemoryIdCacheStore();
    const page = makeFakePage({
      ...baseResponses,
      "list/leagues": { data: [] },
    });

    const result = await resolveLeagueIds({
      page,
      cacheStore,
      logger: makeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      leagueName: "Girls U12",
      competitionName: "FFV",
      seasonYear: "2026",
    });

    expect(result.ok).toBe(false);
  });
});
