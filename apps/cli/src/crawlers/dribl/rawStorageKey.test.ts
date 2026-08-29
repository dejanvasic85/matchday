import {
  buildRawClubEnrichmentKey,
  buildRawFixturesKey,
  buildRawFixtureWindowKey,
  buildRawTableKey,
} from "#crawlers/dribl/rawStorageKey.ts";

describe("buildRawFixturesKey", () => {
  it("builds a key grouped by league and crawl run", () => {
    expect(buildRawFixturesKey("lea_abc123", "run_1", 3, 1)).toBe(
      "deep/lea_abc123/run_1/fixtures-round-3-page-1.json",
    );
  });

  it("keys each page of a round separately", () => {
    expect(buildRawFixturesKey("lea_abc123", "run_1", 3, 2)).toBe(
      "deep/lea_abc123/run_1/fixtures-round-3-page-2.json",
    );
  });
});

describe("buildRawFixtureWindowKey", () => {
  it("keys each page of the current fixture window by position, not round", () => {
    expect(buildRawFixtureWindowKey("lea_abc123", "run_1", 2)).toBe(
      "deep/lea_abc123/run_1/fixtures-window-page-2.json",
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
