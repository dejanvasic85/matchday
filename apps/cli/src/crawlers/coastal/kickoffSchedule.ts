// Coastal kickoff times. Each round spreads its six matches across Friday, Saturday and Sunday in
// Melbourne local time, on the weekend that starts the round's Friday.

import { roundKickoffSlotsValue } from "#crawlers/coastal/constants.ts";
import { addDays } from "#crawlers/coastal/isoDateMath.ts";
import { melbourneInstant } from "#crawlers/coastal/melbourneTime.ts";
import type { CoastalSeason } from "#crawlers/coastal/schemas.ts";

/** Matches per round, fixed by the six kickoff slots. */
export const matchesPerRound = roundKickoffSlotsValue.length;

/** The kickoff instant for a round's `matchIndex`-th match, Melbourne local time. */
export function kickoffInstant(season: CoastalSeason, round: number, matchIndex: number): Date {
  const slot = roundKickoffSlotsValue[matchIndex];
  if (slot === undefined) {
    throw new Error(`Round has ${matchesPerRound} kickoff slots; asked for index ${matchIndex}`);
  }
  const day = addDays(season.startsOn, (round - 1) * 7 + slot.dayOffset);
  return melbourneInstant(day, slot.hour, slot.minute);
}
