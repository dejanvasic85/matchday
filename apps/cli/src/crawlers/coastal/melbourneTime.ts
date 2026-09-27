// Melbourne wall-clock conversions for Coastal kickoffs. Matches are scheduled in local time, so a
// "Saturday 3pm" kickoff must stay 3pm through daylight-saving changes. Intl carries the timezone
// database, so we resolve the offset rather than hard-code it.

import { melbourneTimeZone, type IsoDate } from "@matchday/domain";
import { isoDateLiteral } from "#crawlers/coastal/isoDateMath.ts";

export type MelbourneWallClock = {
  date: IsoDate;
  hour: number;
  minute: number;
};

const wallClockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: melbourneTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((candidate) => candidate.type === type)?.value;
  return Number(value ?? "0");
}

/** The Melbourne wall clock at a given instant. */
export function melbourneWallClock(instant: Date): MelbourneWallClock {
  const parts = wallClockFormatter.formatToParts(instant);
  const year = part(parts, "year");
  const month = part(parts, "month");
  const day = part(parts, "day");
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    date: isoDateLiteral(isoDate),
    hour: part(parts, "hour"),
    minute: part(parts, "minute"),
  };
}

/** Melbourne's UTC offset at an instant, in milliseconds (positive east of UTC). */
function zoneOffsetMilliseconds(instant: Date): number {
  const wall = melbourneWallClock(instant);
  const [year, month, day] = wall.date.split("-").map(Number);
  const wallAsUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, wall.hour, wall.minute);
  return wallAsUtc - instant.getTime();
}

/** The instant at which the Melbourne wall clock reads `date` + `hour:minute`. Resolved twice so a
 * kickoff straddling a daylight-saving change converges on the right offset. */
export function melbourneInstant(date: IsoDate, hour: number, minute: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  const wallAsUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, minute);
  const firstGuess = new Date(wallAsUtc - zoneOffsetMilliseconds(new Date(wallAsUtc)));
  return new Date(wallAsUtc - zoneOffsetMilliseconds(firstGuess));
}
