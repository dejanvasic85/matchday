// The rare ways a Coastal match does not kick off as scheduled. A seeded draw decides, so the same
// match always behaves the same way, and consumers still meet postponed, cancelled and moved
// fixtures.

import { matchEventChanceValue, rescheduleWeekRangeValue } from "#crawlers/coastal/constants.ts";
import { addDays } from "#crawlers/coastal/isoDateMath.ts";
import { melbourneInstant, melbourneWallClock } from "#crawlers/coastal/melbourneTime.ts";
import type { SeededRandom } from "#crawlers/coastal/random.ts";

export const matchEventValue = {
  cancelled: "cancelled",
  postponed: "postponed",
  rescheduled: "rescheduled",
  normal: "normal",
} as const;

export type MatchEvent = (typeof matchEventValue)[keyof typeof matchEventValue];

/** Draw a match's fate from one uniform: the first chance band that contains it wins. */
export function drawMatchEvent(random: SeededRandom): MatchEvent {
  const roll = random();
  const { cancelled, postponed, rescheduled } = matchEventChanceValue;
  if (roll < cancelled) {
    return matchEventValue.cancelled;
  }
  if (roll < cancelled + postponed) {
    return matchEventValue.postponed;
  }
  if (roll < cancelled + postponed + rescheduled) {
    return matchEventValue.rescheduled;
  }
  return matchEventValue.normal;
}

/** A reschedule moves the match on whole calendar weeks, keeping the same Melbourne wall-clock
 * kickoff. Adding elapsed milliseconds would shift it an hour across a daylight-saving change. */
export function rescheduleKickoff(kickoffAt: Date, random: SeededRandom): Date {
  const { min, max } = rescheduleWeekRangeValue;
  const weeks = min + Math.floor(random() * (max - min + 1));
  const wall = melbourneWallClock(kickoffAt);
  return melbourneInstant(addDays(wall.date, weeks * 7), wall.hour, wall.minute);
}
