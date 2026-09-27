// The Coastal ladder: three points a win, one a draw, ranked by points, then goal difference, then
// goals scored, then club name. Only completed matches count, so the table fills in as the season
// plays out.

import { fixtureStatusValue } from "@matchday/domain";
import { coastalClubs, findCoastalClub } from "#crawlers/coastal/roster.ts";
import {
  coastalLadderRowSchema,
  type CoastalFixture,
  type CoastalLadderRow,
} from "#crawlers/coastal/schemas.ts";

type Tally = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

const emptyTally = (): Tally => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
});

function requireTally(tallies: Map<string, Tally>, clubKey: string): Tally {
  const tally = tallies.get(clubKey);
  if (tally === undefined) {
    throw new Error(`Ladder has no row for club "${clubKey}"`);
  }
  return tally;
}

function applyResult(tally: Tally, scored: number, conceded: number): void {
  tally.played += 1;
  tally.goalsFor += scored;
  tally.goalsAgainst += conceded;
  if (scored > conceded) {
    tally.won += 1;
  } else if (scored === conceded) {
    tally.drawn += 1;
  } else {
    tally.lost += 1;
  }
}

type RankedRow = Omit<CoastalLadderRow, "position">;

function compareRows(a: RankedRow, b: RankedRow, nameOf: (clubKey: string) => string): number {
  if (a.points !== b.points) {
    return b.points - a.points;
  }
  if (a.goalDifference !== b.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }
  if (a.goalsFor !== b.goalsFor) {
    return b.goalsFor - a.goalsFor;
  }
  return nameOf(a.clubKey).localeCompare(nameOf(b.clubKey));
}

/** Build the ladder from a season's fixtures, one row per club, in finishing order. */
export function buildLadder(fixtures: readonly CoastalFixture[]): CoastalLadderRow[] {
  const tallies = new Map<string, Tally>();
  for (const club of coastalClubs) {
    tallies.set(club.key, emptyTally());
  }

  for (const fixture of fixtures) {
    if (fixture.status !== fixtureStatusValue.completed) {
      continue;
    }
    if (fixture.homeScore === null || fixture.awayScore === null) {
      continue;
    }
    applyResult(requireTally(tallies, fixture.homeClubKey), fixture.homeScore, fixture.awayScore);
    applyResult(requireTally(tallies, fixture.awayClubKey), fixture.awayScore, fixture.homeScore);
  }

  const rows: RankedRow[] = [];
  for (const [clubKey, tally] of tallies) {
    rows.push({
      clubKey,
      ...tally,
      goalDifference: tally.goalsFor - tally.goalsAgainst,
      points: tally.won * 3 + tally.drawn,
    });
  }

  const nameOf = (clubKey: string): string => findCoastalClub(clubKey)?.name ?? clubKey;
  rows.sort((a, b) => compareRows(a, b, nameOf));

  return rows.map((row, index) => coastalLadderRowSchema.parse({ position: index + 1, ...row }));
}
