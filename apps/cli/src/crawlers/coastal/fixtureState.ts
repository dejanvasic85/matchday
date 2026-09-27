// A Coastal fixture's state from the clock alone. Nothing is stored as "progress": a match is
// scheduled before kickoff, in progress until full time, and completed after it, with the score
// drawn from the match's seed. Re-running at the same time therefore gives identical rows.

import { fixtureStatusValue, type FixtureStatus } from "@matchday/domain";
import { matchDurationMinutes } from "#crawlers/coastal/constants.ts";
import { createSeededRandom } from "#crawlers/coastal/random.ts";
import { drawScore } from "#crawlers/coastal/scoreModel.ts";

const millisecondsPerMinute = 60 * 1000;

export type FixtureClockState = {
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
};

/** The state of a match at `now`, given its kickoff and the clubs' ratings. */
export function fixtureStateAt(
  kickoffAt: Date,
  now: Date,
  homeStrength: number,
  awayStrength: number,
  scoreSeed: number,
): FixtureClockState {
  const kickoff = kickoffAt.getTime();
  const fullTime = kickoff + matchDurationMinutes * millisecondsPerMinute;
  const nowMilliseconds = now.getTime();

  if (nowMilliseconds < kickoff) {
    return { status: fixtureStatusValue.scheduled, homeScore: null, awayScore: null };
  }
  if (nowMilliseconds < fullTime) {
    return { status: fixtureStatusValue.inProgress, homeScore: null, awayScore: null };
  }

  const score = drawScore(homeStrength, awayStrength, createSeededRandom(scoreSeed));
  return { status: fixtureStatusValue.completed, homeScore: score.home, awayScore: score.away };
}
