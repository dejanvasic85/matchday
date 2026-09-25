// Calendar dates for season windows: "which day is it in Melbourne?" and ISO day-string
// comparison. A season starts and ends on a *day*, so the column is a Postgres `date`.

import { z } from "zod";

export const melbourneTimeZone = "Australia/Melbourne";
// A UTC runner's "today" can be a day behind Melbourne, so resolve the day there. Intl carries
// the ICU database, DST included, so no timezone library is needed.

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day as `YYYY-MM-DD`, the shape a Postgres `date` column round-trips and a string
 * comparison orders correctly. Branded so a bare `string` can't be passed where a date is meant. */
export type IsoDate = string & { readonly __brand: "IsoDate" };

/** Zod schema for {@link IsoDate}. Beside the brand so the regex has exactly one home. */
export const isoDateSchema = z.custom<IsoDate>(
  (value) => typeof value === "string" && isIsoDate(value),
  "must be a YYYY-MM-DD date",
);

/** True for an exact `YYYY-MM-DD` string, narrowing to {@link IsoDate}. Not a full calendar
 * validation (the database rejects `2026-02-30`); this only keeps a typo'd or timestamp-shaped
 * value out of a `date` column. */
export function isIsoDate(value: string): value is IsoDate {
  return isoDatePattern.test(value);
}

/** Validate a raw string into an {@link IsoDate}, or `undefined` when it isn't one. The cast-free
 * way to build a branded date from a literal (test fixtures, config). */
export function parseIsoDate(value: string): IsoDate | undefined {
  return isIsoDate(value) ? value : undefined;
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
  const value = `${year}-${month}-${day}`;
  if (!isIsoDate(value)) {
    throw new Error(`Melbourne date ${value} is not YYYY-MM-DD`);
  }
  return value;
}

/** True when `endsOn` is a date strictly before `today` — the season has finished. A season with
 * no end date is never finished: we cannot say when it ended, so we never prune its
 * subscriptions. */
export function hasSeasonFinished(endsOn: IsoDate | null, today: IsoDate): boolean {
  return endsOn !== null && endsOn < today;
}
