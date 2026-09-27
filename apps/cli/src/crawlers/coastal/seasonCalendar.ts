// The Coastal season calendar. Seasons tile forward from the first season by whole 15-week cycles,
// so "which season is it?" is a pure lookup on today's date — no stored schedule. A season's name
// comes from the season of the year its first round lands in, which yields names like "2026 Spring"
// and "2027 Summer".

import type { IsoDate } from "@matchday/domain";
import {
  firstSeasonStartsOn,
  seasonCycleWeeks,
  seasonPlayWeeks,
} from "#crawlers/coastal/constants.ts";
import { addDays, differenceInDays, isWithinRange } from "#crawlers/coastal/isoDateMath.ts";
import { coastalSeasonSchema, type CoastalSeason } from "#crawlers/coastal/schemas.ts";

/** A round's weekend runs Friday-to-Sunday: the last match is two days after the Friday. */
const playDaysPerSeason = (seasonPlayWeeks - 1) * 7 + 2;

const cycleDays = seasonCycleWeeks * 7;

/** Southern-hemisphere meteorological season for each month, January first. */
const seasonLabelByMonth = [
  "Summer",
  "Summer",
  "Autumn",
  "Autumn",
  "Autumn",
  "Winter",
  "Winter",
  "Winter",
  "Spring",
  "Spring",
  "Spring",
  "Summer",
] as const;

function seasonLabelForMonth(month: number): string {
  const label = seasonLabelByMonth[month - 1];
  if (label === undefined) {
    throw new Error(`No season label for month ${month}`);
  }
  return label;
}

/** The season a start date belongs to, e.g. "2026 Spring". */
export function seasonNameForStart(startsOn: IsoDate): string {
  const year = startsOn.slice(0, 4);
  const month = Number(startsOn.slice(5, 7));
  return `${year} ${seasonLabelForMonth(month)}`;
}

/** A stable slug for a season, used to build fixture keys. */
export function seasonKey(season: CoastalSeason): string {
  return season.name.toLowerCase().replaceAll(" ", "-");
}

/** The `index`-th season counting from the first, 0-based. Negative indexes reach into the past
 * only in arithmetic, never in generated output. */
export function seasonWindowForIndex(index: number): CoastalSeason {
  const startsOn = addDays(firstSeasonStartsOn, index * cycleDays);
  const endsOn = addDays(startsOn, playDaysPerSeason);
  return coastalSeasonSchema.parse({
    name: seasonNameForStart(startsOn),
    startsOn,
    endsOn,
  });
}

export type CoastalSeasonLookup = {
  /** The season in play today, or null during the break between seasons. */
  running: CoastalSeason | null;
  /** The season after the running one, or the first season when today predates it. */
  next: CoastalSeason;
};

/** Resolve today's running and upcoming seasons. */
export function seasonsAt(today: IsoDate): CoastalSeasonLookup {
  const elapsedDays = differenceInDays(firstSeasonStartsOn, today);
  if (elapsedDays < 0) {
    return { running: null, next: seasonWindowForIndex(0) };
  }

  const index = Math.floor(elapsedDays / cycleDays);
  const candidate = seasonWindowForIndex(index);
  if (isWithinRange(today, candidate.startsOn, candidate.endsOn)) {
    return { running: candidate, next: seasonWindowForIndex(index + 1) };
  }
  return { running: null, next: seasonWindowForIndex(index + 1) };
}

/**
 * The seasons the catalog crawl should ensure exist today. While a season is running, that one;
 * during a break, the next one — so the following league's fixtures are ready before it starts.
 */
export function seasonsToGenerate(today: IsoDate): CoastalSeason[] {
  const { running, next } = seasonsAt(today);
  return running === null ? [next] : [running];
}
