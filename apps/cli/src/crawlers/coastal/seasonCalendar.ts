// The Coastal season calendar. Each season starts on the first Friday on or after mid-August and
// runs into May, so a season straddles two calendar years and its name shows both, e.g. "2026-27".
// "Which season is it?" is a pure lookup on today's date — no stored schedule. The gap between May
// and August is the off-season.

import type { IsoDate } from "@matchday/domain";
import {
  rescheduleWeekRangeValue,
  seasonAnchor,
  seasonRoundCountValue,
} from "#crawlers/coastal/constants.ts";
import { addDays, firstWeekdayOnOrAfter } from "#crawlers/coastal/isoDateMath.ts";
import { coastalSeasonSchema, type CoastalSeason } from "#crawlers/coastal/schemas.ts";

/** A round's weekend runs Friday-to-Sunday, and a late fixture may be rescheduled up to the maximum
 * delay. The window covers that, so a delayed result is never left after the season "finished". */
const playDaysPerSeason = (seasonRoundCountValue - 1) * 7 + 2 + rescheduleWeekRangeValue.max * 7;

const friday = 5;

/** The Friday a season's first round kicks off: the first Friday on or after the August anchor. */
export function seasonStartForYear(year: number): IsoDate {
  return firstWeekdayOnOrAfter(seasonAnchor(year), friday);
}

/** A season's name, spanning the years it runs across, e.g. 2026 → "2026-27". */
export function seasonNameForYear(year: number): string {
  const nextYear = String((year + 1) % 100).padStart(2, "0");
  return `${year}-${nextYear}`;
}

/** The `year`-started season's calendar window. */
export function seasonWindowForYear(year: number): CoastalSeason {
  const startsOn = seasonStartForYear(year);
  return coastalSeasonSchema.parse({
    name: seasonNameForYear(year),
    startsOn,
    endsOn: addDays(startsOn, playDaysPerSeason),
  });
}

/** A stable slug for a season, used to build fixture keys. */
export function seasonKey(season: CoastalSeason): string {
  return season.name.toLowerCase();
}

export type CoastalSeasonLookup = {
  /** The season in play today, or null during the May-to-August off-season. */
  running: CoastalSeason | null;
  /** The season after the running one, or the next to start when today is in the off-season. */
  next: CoastalSeason;
};

/**
 * Resolve today's running and upcoming seasons. From August the season started this year is running;
 * from January to May the one started last year still is; over June and July neither is.
 */
export function seasonsAt(today: IsoDate): CoastalSeasonLookup {
  const year = Number(today.slice(0, 4));
  const thisYear = seasonWindowForYear(year);
  if (today >= thisYear.startsOn) {
    return { running: thisYear, next: seasonWindowForYear(year + 1) };
  }

  const lastYear = seasonWindowForYear(year - 1);
  if (today <= lastYear.endsOn) {
    return { running: lastYear, next: thisYear };
  }
  return { running: null, next: thisYear };
}

/**
 * The seasons the catalog crawl should ensure exist today. While a season is running, that one;
 * during the off-season, the next one — so the following league's fixtures are ready before it
 * starts.
 */
export function seasonsToGenerate(today: IsoDate): CoastalSeason[] {
  const { running, next } = seasonsAt(today);
  return running === null ? [next] : [running];
}
