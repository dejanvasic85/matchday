// Coastal Football Association generator tuning. The association is fictional and plays year-round,
// so its calendar is generated rather than crawled. Constants that shape the competition live here;
// values consumed by one module stay beside that module.

import { isoDateLiteral } from "#crawlers/coastal/isoDateMath.ts";

/** The first season starts on this Friday. Later seasons tile forward from it. */
export const firstSeasonStartsOn = isoDateLiteral("2026-10-02");

/** A season is 13 weekly rounds of play, then a break, for a 15-week cycle — about three a year. */
export const seasonCycleWeeks = 15;
export const seasonPlayWeeks = 13;

/** A match runs for 105 minutes: 90 plus a half-time break, with no stoppage time modelled. */
export const matchDurationMinutes = 105;

/**
 * Seeded chances a match does not play out normally, so consumers meet the awkward states. They are
 * small: an 78-match season should show a handful across all three.
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
 * The six kickoff slots a round fills, in Melbourne wall-clock time. `dayOffset` is counted from the
 * round's Friday: Friday 0, Saturday 1, Sunday 2. Each match is played at the home club's ground.
 */
export const roundKickoffSlotsValue = [
  { dayOffset: 0, hour: 19, minute: 30 },
  { dayOffset: 1, hour: 13, minute: 0 },
  { dayOffset: 1, hour: 15, minute: 0 },
  { dayOffset: 1, hour: 17, minute: 0 },
  { dayOffset: 2, hour: 13, minute: 0 },
  { dayOffset: 2, hour: 15, minute: 0 },
] as const;
