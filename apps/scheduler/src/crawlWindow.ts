// When is a crawl allowed to run? Pure decision logic, kept out of the cron expression on purpose.
//
// Cloudflare cron (like GitHub's) is UTC-only, so a fixed UTC expression drifts by an hour every
// time Melbourne switches to daylight saving. Deciding here instead means the windows are
// expressed in local time, survive the AEST/AEDT switch untouched, and are unit-testable.
//
// A window says only that a tick is eligible. Whether the crawl actually needs to run again is
// reconciled against its GitHub run history in `crawlReconciler.ts`.

/** Windows in Melbourne local time, as `[startHour, endHour]` inclusive of both ends. */
const leagueWindowValue = {
  // Weekday evenings: games run under lights.
  weekday: { startHour: 18, endHour: 23 },
  // Weekends: games run through the day.
  weekend: { startHour: 11, endHour: 23 },
} as const;

/** The catalog's weekly slot. Early Tuesday is quiet — no games in flight, and a full source-wide
 * crawl has the runner to itself. Wide enough that a dropped tick still lands inside it. */
const catalogWindowValue = { weekday: "Tue", startHour: 2, endHour: 6 } as const;

const melbourneTimeZone = "Australia/Melbourne";

/** Local hour (0-23) and weekday for `instant` in Melbourne, DST included. Workers ship the full
 * ICU timezone database, so `Intl` does the AEST/AEDT arithmetic for us. */
function toMelbourneParts(instant: Date): { hour: number; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: melbourneTimeZone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });

  let hour: number | undefined;
  let weekday: string | undefined;
  for (const part of formatter.formatToParts(instant)) {
    if (part.type === "hour") {
      // "24" is midnight under hour12:false in some ICU versions — normalise it to 0.
      hour = Number(part.value) % 24;
    }
    if (part.type === "weekday") {
      weekday = part.value;
    }
  }

  if (hour === undefined || weekday === undefined) {
    throw new Error(`Could not read Melbourne hour/weekday from ${instant.toISOString()}`);
  }
  return { hour, weekday };
}

const weekendDayValue = ["Sat", "Sun"];

export type WindowDecision = {
  inWindow: boolean;
  /** Melbourne local hour the decision was made for — logged so a skipped tick explains itself. */
  localHour: number;
  localWeekday: string;
};

/** True inside a game window in Melbourne local time. */
export function isInLeagueWindow(instant: Date): WindowDecision {
  const { hour, weekday } = toMelbourneParts(instant);
  const window = weekendDayValue.includes(weekday)
    ? leagueWindowValue.weekend
    : leagueWindowValue.weekday;

  return {
    inWindow: hour >= window.startHour && hour <= window.endHour,
    localHour: hour,
    localWeekday: weekday,
  };
}

/** True inside the catalog's weekly slot, pinned to Melbourne local time so it stays put through
 * the AEST/AEDT switch instead of drifting an hour. */
export function isInCatalogWindow(instant: Date): WindowDecision {
  const { hour, weekday } = toMelbourneParts(instant);

  return {
    inWindow:
      weekday === catalogWindowValue.weekday &&
      hour >= catalogWindowValue.startHour &&
      hour <= catalogWindowValue.endHour,
    localHour: hour,
    localWeekday: weekday,
  };
}
