import { createInMemoryIdCacheStore } from "#crawlers/dribl/idCache.ts";

describe("createInMemoryIdCacheStore", () => {
  it("starts with an empty cache when no initial value is given", async () => {
    const store = createInMemoryIdCacheStore();

    const cache = await store.load();

    expect(cache).toEqual({ leagues: {} });
  });

  it("returns what was last saved", async () => {
    const store = createInMemoryIdCacheStore();
    const ids = { season: "s", competition: "c", league: "l", tenant: "t" };

    await store.save({ tenant: "t", leagues: { "Girls U12": ids } });
    const cache = await store.load();

    expect(cache).toEqual({ tenant: "t", leagues: { "Girls U12": ids } });
  });
});
