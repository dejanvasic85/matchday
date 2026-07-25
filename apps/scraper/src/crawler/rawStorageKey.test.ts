import {
  buildRawClubEnrichmentKey,
  buildRawFixturesKey,
  buildRawTableKey,
} from "./rawStorageKey.ts";

describe("buildRawFixturesKey", () => {
  it("builds a key grouped by league and crawl run", () => {
    expect(buildRawFixturesKey("lea_abc123", "run_1", 3)).toBe(
      "deep/lea_abc123/run_1/fixtures-round-3.json",
    );
  });
});

describe("buildRawTableKey", () => {
  it("builds a key grouped by league and crawl run", () => {
    expect(buildRawTableKey("lea_abc123", "run_1")).toBe("deep/lea_abc123/run_1/table.json");
  });
});

describe("buildRawClubEnrichmentKey", () => {
  it("builds a key grouped by crawl run", () => {
    expect(buildRawClubEnrichmentKey("run_1", "3vmZv3YLmq")).toBe(
      "club-enrichment/run_1/club-3vmZv3YLmq.json",
    );
  });
});
