import { tableEntrySchema } from "./tableEntry.ts";

function makeValidTableEntry() {
  return {
    id: "tab_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    teamId: "tea_abc123",
    position: 1,
    played: 10,
    won: 8,
    drawn: 1,
    lost: 1,
    goalsFor: 24,
    goalsAgainst: 8,
    goalDifference: 16,
    points: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("tableEntrySchema", () => {
  it("accepts a valid table entry", () => {
    const result = tableEntrySchema.safeParse(makeValidTableEntry());

    expect(result.success).toBe(true);
  });

  it("rejects a non-integer points value", () => {
    const result = tableEntrySchema.safeParse({ ...makeValidTableEntry(), points: 25.5 });

    expect(result.success).toBe(false);
  });
});
