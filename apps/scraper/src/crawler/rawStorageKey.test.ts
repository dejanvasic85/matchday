import { buildRawFixturesKey, buildRawTableKey } from "./rawStorageKey.ts";

describe("buildRawFixturesKey", () => {
  it("builds a key grouped by tracked competition and crawl run", () => {
    expect(buildRawFixturesKey("trk_abc", "run_1", 3)).toBe(
      "raw/trk_abc/run_1/fixtures-round-3.json",
    );
  });
});

describe("buildRawTableKey", () => {
  it("builds a key grouped by tracked competition and crawl run", () => {
    expect(buildRawTableKey("trk_abc", "run_1")).toBe("raw/trk_abc/run_1/table.json");
  });
});
