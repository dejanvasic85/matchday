import { buildRawFixturesKey, buildRawLaddersKey } from "./rawStorageKey.ts";

describe("buildRawFixturesKey", () => {
  it("builds a key grouped by tracked competition and crawl run", () => {
    expect(buildRawFixturesKey("trk_abc", "run_1", 3)).toBe(
      "raw/trk_abc/run_1/fixtures-round-3.json",
    );
  });
});

describe("buildRawLaddersKey", () => {
  it("builds a key grouped by tracked competition and crawl run", () => {
    expect(buildRawLaddersKey("trk_abc", "run_1")).toBe("raw/trk_abc/run_1/ladders.json");
  });
});
