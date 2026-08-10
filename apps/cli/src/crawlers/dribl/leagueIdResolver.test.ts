import type { Logger } from "@matchday/domain";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { createInMemoryIdCacheStore } from "#crawlers/dribl/idCache.ts";
import { resolveLeagueIds } from "#crawlers/dribl/leagueIdResolver.ts";

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
      return JSON.stringify(matched[1]);
    },
  };
}

const baseResponses = {
  tenants: { data: { id: "tenant-id" } },
  "list/seasons": { data: [{ id: "season-id", name: "2026" }] },
  "list/competitions": {
    data: [{ id: "competition-id", name: "FFV" }],
  },
  "list/leagues": {
    data: [
      { id: "removed-id", name: "(Removed) Girls U12" },
      { id: "league-id", name: "Girls U12" },
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

    assert(!result.ok);
  });

  it("saves the resolved tenant id even when a later list lookup fails", async () => {
    const cacheStore = createInMemoryIdCacheStore();
    const page = makeFakePage({
      ...baseResponses,
      "list/leagues": { data: [] },
    });

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

    expect(cache.tenant).toBe("tenant-id");
    expect(cache.leagues["Girls U12"]).toBeUndefined();
  });

  it("does not re-fetch the tenant on a second call once it's cached from a prior failure", async () => {
    const cacheStore = createInMemoryIdCacheStore({ tenant: "tenant-id", leagues: {} });
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
});
