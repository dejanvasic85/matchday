import { competitionSeasonSchema } from "#entities/competitionSeason.ts";

function makeValidCompetitionSeason() {
  return {
    id: "cse_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    startsOn: "2026-02-01",
    endsOn: "2026-09-30",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("competitionSeasonSchema", () => {
  it("accepts a valid competition-season", () => {
    const result = competitionSeasonSchema.safeParse(makeValidCompetitionSeason());

    expect(result.success).toBe(true);
  });

  it("accepts a competition-season with no dates yet", () => {
    const result = competitionSeasonSchema.safeParse({
      ...makeValidCompetitionSeason(),
      startsOn: null,
      endsOn: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a competition-season missing a competition", () => {
    const { competitionId: _competitionId, ...withoutCompetition } = makeValidCompetitionSeason();

    const result = competitionSeasonSchema.safeParse(withoutCompetition);

    expect(result.success).toBe(false);
  });
});
