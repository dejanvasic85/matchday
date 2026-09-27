// Calendar-day arithmetic for the Coastal generator. A season is a run of *days*, so add and
// compare in UTC day-space and never touch the local clock — the caller's timezone must not shift
// a date by a day.

import { parseIsoDate, type IsoDate } from "@matchday/domain";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

/** Build a branded `IsoDate` from a literal we control, failing loudly on a typo. */
export function isoDateLiteral(value: string): IsoDate {
  const parsed = parseIsoDate(value);
  if (parsed === undefined) {
    throw new Error(`Not a YYYY-MM-DD date: ${value}`);
  }
  return parsed;
}

function toUtcMilliseconds(date: IsoDate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return Date.UTC(year, month - 1, day);
}

function fromUtcMilliseconds(milliseconds: number): IsoDate {
  return isoDateLiteral(new Date(milliseconds).toISOString().slice(0, 10));
}

/** `date` shifted by `days`, which may be negative. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMilliseconds(toUtcMilliseconds(date) + days * millisecondsPerDay);
}

/** Day of week, `0` = Sunday through `6` = Saturday. */
export function weekdayIndex(date: IsoDate): number {
  return new Date(toUtcMilliseconds(date)).getUTCDay();
}

/** The first `weekday` (0 = Sunday) on or after `date`. */
export function firstWeekdayOnOrAfter(date: IsoDate, weekday: number): IsoDate {
  return addDays(date, (weekday - weekdayIndex(date) + 7) % 7);
}
