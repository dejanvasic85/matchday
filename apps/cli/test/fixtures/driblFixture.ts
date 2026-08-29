import type {
  DriblFixture,
  DriblFixtureAttributes,
} from "#crawlers/dribl/external/driblFixture.ts";

export function makeDriblFixtureAttributes(
  overrides: Partial<DriblFixtureAttributes> = {},
): DriblFixtureAttributes {
  return {
    name: "Fixture",
    date: "2026-04-25T23:00:00.000000Z",
    round: "R1",
    full_round: "Round 1",
    ground_name: "AB Shaw Reserve",
    ground_latitude: -37.86,
    ground_longitude: 144.78,
    field_name: null,
    home_team_name: "Home",
    home_team_hash_id: "home-1",
    home_logo: "https://ocean.dribl.com/home",
    away_team_name: "Away",
    away_team_hash_id: "away-1",
    away_logo: "https://ocean.dribl.com/away",
    competition_name: "Comp",
    league_name: "League",
    status: "pending",
    bye_flag: false,
    home_score: null,
    away_score: null,
    ...overrides,
  };
}

export function makeDriblFixture(overrides: Partial<DriblFixture> = {}): DriblFixture {
  return {
    type: "fixtures",
    hash_id: "fixture-0",
    ...overrides,
    attributes: makeDriblFixtureAttributes(overrides.attributes),
  };
}
