import { coastalClubs, findCoastalClub } from "#crawlers/coastal/roster.ts";

describe("coastalClubs", () => {
  it("has the twelve-club roster with one team each", () => {
    expect(coastalClubs).toHaveLength(12);
    for (const club of coastalClubs) {
      expect(club.name).toBe(club.teamName);
      expect(club.ground.length).toBeGreaterThan(0);
    }
  });

  it("includes the required Stadly United first", () => {
    expect(coastalClubs[0]?.name).toBe("Stadly United");
  });

  it("uses unique club keys", () => {
    const keys = new Set(coastalClubs.map((club) => club.key));
    expect(keys.size).toBe(coastalClubs.length);
  });

  it("gives every club a positive strength rating around one", () => {
    for (const club of coastalClubs) {
      expect(club.strength).toBeGreaterThan(0);
      expect(club.strength).toBeLessThan(2);
    }
  });
});

describe("findCoastalClub", () => {
  it("finds a club by key", () => {
    expect(findCoastalClub("harbourside")?.name).toBe("Harbourside FC");
  });

  it("returns undefined for an unknown key", () => {
    expect(findCoastalClub("not-a-club")).toBeUndefined();
  });
});
