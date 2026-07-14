import { fixtureStatusValue } from "../entities/constants.ts";
import type { DriblFixture } from "../external/driblFixture.ts";
import { mapDriblFixture } from "./mapDriblFixture.ts";

function makeDriblFixture(overrides: Partial<DriblFixture["attributes"]> = {}): DriblFixture {
  return {
    type: "fixtures",
    hash_id: "am1409RY6d",
    attributes: {
      name: "Altona North SC U08 vs Williams Landing SC U08",
      date: "2026-04-25T23:00:00.000000Z",
      round: "R1",
      full_round: "Round 1",
      ground_name: "AB Shaw Reserve",
      ground_latitude: -37.865571,
      ground_longitude: 144.783747,
      field_name: "Pitch 2 - Midi B (7v7)",
      home_team_name: "Altona North SC U08",
      home_team_hash_id: "hteam001",
      home_logo: "https://ocean.dribl.com/home-logo",
      away_team_name: "Williams Landing SC U08",
      away_team_hash_id: "ateam002",
      away_logo: "https://ocean.dribl.com/away-logo",
      competition_name: "Coles MiniRoos Mixed Sunday (U6 - U11)",
      league_name: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue",
      status: "pending",
      bye_flag: false,
      home_score: null,
      away_score: null,
      ...overrides,
    },
  };
}

describe("mapDriblFixture", () => {
  it("maps a raw fixture to the mapped domain shape", () => {
    const result = mapDriblFixture(makeDriblFixture());

    expect(result).toEqual({
      sourceId: "am1409RY6d",
      round: 1,
      competitionName: "Coles MiniRoos Mixed Sunday (U6 - U11)",
      leagueName: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue",
      homeTeamName: "Altona North SC U08",
      homeTeamSourceId: "hteam001",
      awayTeamName: "Williams Landing SC U08",
      awayTeamSourceId: "ateam002",
      venue: "AB Shaw Reserve Pitch 2 - Midi B (7v7)",
      latitude: -37.865571,
      longitude: 144.783747,
      kickoffAt: new Date("2026-04-25T23:00:00.000Z"),
      status: fixtureStatusValue.scheduled,
      homeScore: null,
      awayScore: null,
      isBye: false,
    });
  });

  it("parses a results-style date missing a timezone indicator as UTC", () => {
    const fixture = makeDriblFixture({ date: "2026-04-26 03:15:00" });

    const result = mapDriblFixture(fixture);

    expect(result.kickoffAt).toEqual(new Date("2026-04-26T03:15:00.000Z"));
  });

  it("maps a completed status with scores to the completed domain status", () => {
    const fixture = makeDriblFixture({ status: "complete", home_score: 3, away_score: 1 });

    const result = mapDriblFixture(fixture);

    expect(result.status).toBe(fixtureStatusValue.completed);
    expect(result.homeScore).toBe(3);
    expect(result.awayScore).toBe(1);
  });

  it("falls back to scheduled for an unrecognised raw status", () => {
    const fixture = makeDriblFixture({ status: "some_new_dribl_status" });

    const result = mapDriblFixture(fixture);

    expect(result.status).toBe(fixtureStatusValue.scheduled);
  });

  it("maps a bye fixture with a null opponent and ground", () => {
    const fixture = makeDriblFixture({
      away_team_name: null,
      away_team_hash_id: null,
      away_logo: null,
      ground_name: null,
      field_name: null,
      ground_latitude: null,
      ground_longitude: null,
      bye_flag: true,
    });

    const result = mapDriblFixture(fixture);

    expect(result.awayTeamName).toBeNull();
    expect(result.venue).toBeNull();
    expect(result.isBye).toBe(true);
  });
});
