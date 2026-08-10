import type { DriblTableEntry } from "#crawlers/dribl/external/driblTableEntry.ts";
import { mapDriblTableEntry } from "#crawlers/dribl/mappers/mapDriblTableEntry.ts";

function makeDriblTableEntry(
  overrides: Partial<DriblTableEntry["attributes"]> = {},
): DriblTableEntry {
  return {
    type: "ladder-entry",
    id: "table001",
    attributes: {
      team_hash_id: "hteam001",
      team_name: "Altona North SC U08",
      club_code: "ANSC",
      club_name: "Altona North SC",
      club_logo: "https://ocean.dribl.com/club-logo",
      season_name: "2026",
      league_name: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue",
      position: 1,
      played: 5,
      won: 4,
      drawn: 1,
      lost: 0,
      goals_for: 12,
      goals_against: 3,
      goal_difference: 9,
      points: 13,
      ...overrides,
    },
  };
}

describe("mapDriblTableEntry", () => {
  it("maps a raw table entry to the mapped domain shape", () => {
    const result = mapDriblTableEntry(makeDriblTableEntry());

    expect(result).toEqual({
      teamSourceId: "hteam001",
      teamName: "Altona North SC U08",
      clubCode: "ANSC",
      clubName: "Altona North SC",
      clubLogoUrl: "https://ocean.dribl.com/club-logo",
      leagueName: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue",
      seasonName: "2026",
      position: 1,
      played: 5,
      won: 4,
      drawn: 1,
      lost: 0,
      goalsFor: 12,
      goalsAgainst: 3,
      goalDifference: 9,
      points: 13,
    });
  });

  it("maps a null club logo through as null", () => {
    const result = mapDriblTableEntry(makeDriblTableEntry({ club_logo: null }));

    expect(result.clubLogoUrl).toBeNull();
  });

  it("trims incidental whitespace from the club name", () => {
    const result = mapDriblTableEntry(makeDriblTableEntry({ club_name: "  Altona North SC  " }));

    expect(result.clubName).toBe("Altona North SC");
  });
});
