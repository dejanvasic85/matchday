import { driblFixturesApiResponseSchema } from "#crawlers/dribl/external/driblFixture.ts";

function makeDriblFixtureAttributes(overrides: Record<string, unknown> = {}) {
  return {
    name: "Home Team vs Away Team",
    date: "2026-04-25T23:00:00.000000Z",
    round: "R1",
    full_round: "Round 1",
    ground_name: "AB Shaw Reserve",
    ground_latitude: -37.865571,
    ground_longitude: 144.783747,
    field_name: null,
    home_team_name: "Home Team",
    home_team_hash_id: "home-1",
    home_logo: null,
    away_team_name: "Away Team",
    away_team_hash_id: "away-1",
    away_logo: null,
    competition_name: "Senol NPL Victoria Men",
    league_name: "NPL VIC Men",
    status: "pending",
    bye_flag: false,
    home_score: null,
    away_score: null,
    ...overrides,
  };
}

describe("driblFixturesApiResponseSchema", () => {
  it("accepts ground_latitude/ground_longitude as numbers", () => {
    const result = driblFixturesApiResponseSchema.safeParse({
      data: [{ type: "fixtures", hash_id: "fix-1", attributes: makeDriblFixtureAttributes() }],
    });

    expect(result.success).toBe(true);
  });

  it("coerces ground_latitude/ground_longitude sent as numeric strings", () => {
    const result = driblFixturesApiResponseSchema.safeParse({
      data: [
        {
          type: "fixtures",
          hash_id: "fix-1",
          attributes: makeDriblFixtureAttributes({
            ground_latitude: "-37.865571",
            ground_longitude: "144.783747",
          }),
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data[0]?.attributes.ground_latitude).toBe(-37.865571);
    expect(result.data?.data[0]?.attributes.ground_longitude).toBe(144.783747);
  });

  it("accepts a null ground_latitude/ground_longitude", () => {
    const result = driblFixturesApiResponseSchema.safeParse({
      data: [
        {
          type: "fixtures",
          hash_id: "fix-1",
          attributes: makeDriblFixtureAttributes({
            ground_latitude: null,
            ground_longitude: null,
          }),
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data[0]?.attributes.ground_latitude).toBe(null);
  });
});
