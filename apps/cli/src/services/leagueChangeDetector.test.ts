import type { schema } from "@matchday/db";
import { detectLeagueChanges, type LeagueSnapshot } from "#services/leagueChangeDetector.ts";

type FixtureRow = typeof schema.fixture.$inferSelect;
type TableEntryRow = typeof schema.tableEntry.$inferSelect;

const epoch = new Date("2026-01-01T00:00:00.000Z");
const kickoffAt = new Date("2026-03-14T10:00:00.000Z");

function makeFixtureRow(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: "mtc_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    round: 3,
    homeTeamId: "tea_home0001",
    awayTeamId: "tea_away0001",
    venue: "Home Ground",
    latitude: "-37.812200",
    longitude: "144.960000",
    kickoffAt,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    isBye: false,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeTableEntryRow(overrides: Partial<TableEntryRow> = {}): TableEntryRow {
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
    goalsFor: 20,
    goalsAgainst: 5,
    goalDifference: 15,
    points: 25,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<LeagueSnapshot> = {}): LeagueSnapshot {
  return {
    fixtures: [makeFixtureRow()],
    tableEntries: [makeTableEntryRow()],
    ...overrides,
  };
}

describe("detectLeagueChanges", () => {
  it("reports no changes when before and after are identical", () => {
    const summary = detectLeagueChanges(makeSnapshot(), makeSnapshot());

    expect(summary).toEqual({ hasChanges: false, fixturesChanged: 0, tableChanged: false });
  });

  it("ignores updatedAt/createdAt bumps with no other change (every upsert touches them)", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      fixtures: [makeFixtureRow({ updatedAt: new Date("2026-02-01T00:00:00.000Z") })],
      tableEntries: [makeTableEntryRow({ updatedAt: new Date("2026-02-01T00:00:00.000Z") })],
    });

    const summary = detectLeagueChanges(before, after);

    expect(summary).toEqual({ hasChanges: false, fixturesChanged: 0, tableChanged: false });
  });

  it("counts a fixture whose score/status changed", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      fixtures: [makeFixtureRow({ status: "completed", homeScore: 2, awayScore: 1 })],
    });

    const summary = detectLeagueChanges(before, after);

    expect(summary).toEqual({ hasChanges: true, fixturesChanged: 1, tableChanged: false });
  });

  it("counts a fixture that's new in the after snapshot", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      fixtures: [makeFixtureRow(), makeFixtureRow({ id: "mtc_new0001" })],
    });

    const summary = detectLeagueChanges(before, after);

    expect(summary).toEqual({ hasChanges: true, fixturesChanged: 1, tableChanged: false });
  });

  it("reports tableChanged when a team's position/points changed", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      tableEntries: [makeTableEntryRow({ position: 2, points: 22 })],
    });

    const summary = detectLeagueChanges(before, after);

    expect(summary).toEqual({ hasChanges: true, fixturesChanged: 0, tableChanged: true });
  });

  it("reports tableChanged when a team is added to the ladder", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      tableEntries: [
        makeTableEntryRow(),
        makeTableEntryRow({ id: "tab_new0001", teamId: "tea_new0001" }),
      ],
    });

    const summary = detectLeagueChanges(before, after);

    expect(summary).toEqual({ hasChanges: true, fixturesChanged: 0, tableChanged: true });
  });
});
