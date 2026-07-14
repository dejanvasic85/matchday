import { leagueSchema } from "./league.ts";

function makeValidLeague() {
  return {
    id: "lea_abc123",
    name: "VPL Division 1",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("leagueSchema", () => {
  it("accepts a valid league", () => {
    const result = leagueSchema.safeParse(makeValidLeague());

    expect(result.success).toBe(true);
  });

  it("rejects a league missing seasonId", () => {
    const { seasonId: _seasonId, ...withoutSeasonId } = makeValidLeague();

    const result = leagueSchema.safeParse(withoutSeasonId);

    expect(result.success).toBe(false);
  });
});
