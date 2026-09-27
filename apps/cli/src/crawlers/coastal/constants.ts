// Coastal Football Association generator tuning. The association is fictional and plays on a
// European-style calendar, so its schedule is generated rather than crawled. Constants that shape
// the competition live here; values consumed by one module stay beside that module.

import { isIsoDate, type IsoDate } from "@matchday/domain";

/** Every season starts on the first Friday on or after this August day, and runs into May. */
const seasonStartValue = {
  month: 8,
  day: 15,
} as const;

/** A 20-club double round-robin: each club plays the other 19 home and away, for 38 weekly rounds. */
export const seasonRoundCountValue = 38;

/** A match runs for 105 minutes: 90 plus a half-time break, with no stoppage time modelled. */
export const matchDurationMinutes = 105;

/**
 * Seeded chances a match does not play out normally, so consumers meet the awkward states. They are
 * small: a 380-match season should show a handful across all three.
 */
export const matchEventChanceValue = {
  cancelled: 0.01,
  postponed: 0.015,
  rescheduled: 0.02,
} as const;

/** A rescheduled match moves forward one to three whole weeks. */
export const rescheduleWeekRangeValue = {
  min: 1,
  max: 3,
} as const;

/** The knobs that shape scores: league-average goals per team, and the home side's edge. */
export const scoreModelValue = {
  baseGoalsPerTeam: 1.35,
  homeAdvantage: 1.15,
  maxGoals: 8,
} as const;

/**
 * The ten kickoff slots a round fills, in Melbourne wall-clock time. `dayOffset` is counted from the
 * round's Friday: Friday 0, Saturday 1, Sunday 2. Each match is played at the home club's ground.
 */
export const roundKickoffSlotsValue = [
  { dayOffset: 0, hour: 19, minute: 30 },
  { dayOffset: 1, hour: 12, minute: 30 },
  { dayOffset: 1, hour: 15, minute: 0 },
  { dayOffset: 1, hour: 15, minute: 0 },
  { dayOffset: 1, hour: 17, minute: 30 },
  { dayOffset: 1, hour: 19, minute: 45 },
  { dayOffset: 2, hour: 14, minute: 0 },
  { dayOffset: 2, hour: 14, minute: 0 },
  { dayOffset: 2, hour: 16, minute: 30 },
  { dayOffset: 2, hour: 16, minute: 30 },
] as const;

/** Build the August anchor for a season's start year, e.g. `2026-08-15`. */
export function seasonAnchor(year: number): IsoDate {
  const month = String(seasonStartValue.month).padStart(2, "0");
  const day = String(seasonStartValue.day).padStart(2, "0");
  const value = `${year}-${month}-${day}`;
  if (!isIsoDate(value)) {
    throw new Error(`Season anchor is not a valid date: ${value}`);
  }
  return value;
}
