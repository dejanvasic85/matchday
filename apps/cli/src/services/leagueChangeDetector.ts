// League change detection (#105): compares a league's fixtures + table before vs. after a deep
// crawl to decide whether a webhook notification should report `hasChanges`. Pure comparison over
// two already-fetched snapshots — no DB/network here, so it's cheap to unit test and independent
// of crawler internals. Timestamps (`createdAt`/`updatedAt`) are deliberately excluded from the
// comparison: the crawl's upsert bumps `updatedAt` on every row it touches regardless of whether
// any visible field actually changed, so comparing it would report a change on every run.

import type { schema } from "@matchday/db";

type Fixture = typeof schema.fixture.$inferSelect;
type TableEntry = typeof schema.tableEntry.$inferSelect;

export type LeagueSnapshot = {
  fixtures: Fixture[];
  tableEntries: TableEntry[];
};

export type LeagueChangeSummary = {
  hasChanges: boolean;
  fixturesChanged: number;
  tableChanged: boolean;
};

function datesEqual(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.getTime() === b.getTime();
}

function fixturesEqual(a: Fixture, b: Fixture): boolean {
  return (
    a.round === b.round &&
    a.homeTeamId === b.homeTeamId &&
    a.awayTeamId === b.awayTeamId &&
    a.venue === b.venue &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    datesEqual(a.kickoffAt, b.kickoffAt) &&
    a.status === b.status &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    a.isBye === b.isBye
  );
}

function tableEntriesEqual(a: TableEntry, b: TableEntry): boolean {
  return (
    a.position === b.position &&
    a.played === b.played &&
    a.won === b.won &&
    a.drawn === b.drawn &&
    a.lost === b.lost &&
    a.goalsFor === b.goalsFor &&
    a.goalsAgainst === b.goalsAgainst &&
    a.goalDifference === b.goalDifference &&
    a.points === b.points
  );
}

/** Count of fixtures in `after` that are new (no matching id in `before`) or differ from their
 * `before` counterpart — a deep crawl only discovers/updates fixtures, it never removes one, so a
 * fixture disappearing between snapshots isn't a case this counts. */
function countChangedFixtures(before: Fixture[], after: Fixture[]): number {
  const beforeById = new Map(before.map((fixture) => [fixture.id, fixture]));
  return after.reduce((count, fixture) => {
    const previous = beforeById.get(fixture.id);
    const changed = previous === undefined || !fixturesEqual(previous, fixture);
    return changed ? count + 1 : count;
  }, 0);
}

/** True if the ladder gained/lost a team or any existing team's row differs — the whole ladder is
 * replaced each crawl (schema.ts), so a count-of-changed-teams isn't a meaningful signal the way
 * it is for fixtures. */
function tableEntriesChanged(before: TableEntry[], after: TableEntry[]): boolean {
  if (before.length !== after.length) {
    return true;
  }
  const beforeByTeamId = new Map(before.map((entry) => [entry.teamId, entry]));
  return after.some((entry) => {
    const previous = beforeByTeamId.get(entry.teamId);
    return previous === undefined || !tableEntriesEqual(previous, entry);
  });
}

export function detectLeagueChanges(
  before: LeagueSnapshot,
  after: LeagueSnapshot,
): LeagueChangeSummary {
  const fixturesChanged = countChangedFixtures(before.fixtures, after.fixtures);
  const tableChanged = tableEntriesChanged(before.tableEntries, after.tableEntries);
  return {
    fixturesChanged,
    tableChanged,
    hasChanges: fixturesChanged > 0 || tableChanged,
  };
}
