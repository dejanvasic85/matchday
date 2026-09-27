// The rare ways a Coastal match does not kick off as scheduled. A seeded draw decides, so the same
// match always behaves the same way, and consumers still meet postponed, cancelled and moved
// fixtures.

import { matchEventChanceValue, rescheduleWeekRangeValue } from "#crawlers/coastal/constants.ts";
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

/** A reschedule pushes the match back one to three whole weeks, keeping its slot. */
export function rescheduleKickoff(kickoffAt: Date, random: SeededRandom): Date {
  const { min, max } = rescheduleWeekRangeValue;
  const weeks = min + Math.floor(random() * (max - min + 1));
  return new Date(kickoffAt.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}
