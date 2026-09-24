// Calendar dates for season windows: "which day is it in Melbourne?" and ISO day-string
// comparison. A season starts and ends on a *day*, so the column is a Postgres `date`.

export const melbourneTimeZone = "Australia/Melbourne";
// A UTC runner's "today" can be a day behind Melbourne, so resolve the day there. Intl carries
// the ICU database, DST included, so no timezone library is needed.

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day as `YYYY-MM-DD`, the shape a Postgres `date` column round-trips and a string
 * comparison orders correctly. */
export type IsoDate = string;

/** True for an exact `YYYY-MM-DD` string. Not a full calendar validation (the database rejects
 * `2026-02-30`); this only keeps a typo'd or timestamp-shaped value out of a `date` column. */
export function isIsoDate(value: string): boolean {
  return isoDatePattern.test(value);
}

const melbourneDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: melbourneTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Melbourne as `YYYY-MM-DD`. Assembled from the parts rather than the formatted
 * string, so ICU's exact output order can't change the result. */
export function todayInMelbourne(instant: Date = new Date()): IsoDate {
  const parts = melbourneDateFormatter.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Could not read Melbourne date from ${instant.toISOString()}`);
  }
  return `${year}-${month}-${day}`;
}

/** True when `endsOn` is a date strictly before `today` — the season has finished. A season with
 * no end date is never finished: we cannot say when it ended, so we never prune its
 * subscriptions. */
export function hasSeasonFinished(endsOn: IsoDate | null, today: IsoDate): boolean {
  return endsOn !== null && endsOn < today;
}
