import { fixtureSchema } from "#entities/fixture.ts";

function makeValidFixture() {
  return {
    id: "mtc_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    round: 5,
    homeTeamId: "tea_abc123",
    awayTeamId: "tea_def456",
    venue: "Burt Field",
    latitude: -37.86,
    longitude: 144.89,
    kickoffAt: new Date(),
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    isBye: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("fixtureSchema", () => {
  it("accepts a fully-populated fixture", () => {
    const result = fixtureSchema.safeParse(makeValidFixture());

    expect(result.success).toBe(true);
  });

  it("accepts a bye fixture with null team/venue/score fields", () => {
    const result = fixtureSchema.safeParse({
      ...makeValidFixture(),
      awayTeamId: null,
      venue: null,
      latitude: null,
      longitude: null,
      kickoffAt: null,
      isBye: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = fixtureSchema.safeParse({ ...makeValidFixture(), status: "unknown" });

    expect(result.success).toBe(false);
  });
});
