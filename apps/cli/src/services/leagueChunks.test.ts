import { chunkLeagueIds } from "#services/leagueChunks.ts";

describe("chunkLeagueIds", () => {
  it("deals leagues round-robin so neighbours land on different jobs", () => {
    expect(chunkLeagueIds(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "c", "e"],
      ["b", "d"],
    ]);
  });

  it("never makes more chunks than the cap", () => {
    const chunks = chunkLeagueIds(
      Array.from({ length: 42 }, (_, i) => `lea_${i}`),
      8,
    );

    expect(chunks).toHaveLength(8);
    expect(chunks.flat()).toHaveLength(42);
  });

  it("makes one chunk per league when there are fewer leagues than the cap", () => {
    expect(chunkLeagueIds(["a", "b"], 8)).toEqual([["a"], ["b"]]);
  });

  it("keeps chunk sizes within one of each other", () => {
    const sizes = chunkLeagueIds(
      Array.from({ length: 43 }, (_, i) => `lea_${i}`),
      8,
    ).map((chunk) => chunk.length);

    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("loses no league and duplicates none", () => {
    const leagueIds = Array.from({ length: 20 }, (_, i) => `lea_${i}`);

    const dealt = chunkLeagueIds(leagueIds, 6).flat();

    expect(new Set(dealt)).toEqual(new Set(leagueIds));
    expect(dealt).toHaveLength(leagueIds.length);
  });

  it("returns nothing to run when no league is subscribed", () => {
    expect(chunkLeagueIds([], 8)).toEqual([]);
  });
});
