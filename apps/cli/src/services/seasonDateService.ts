// Season dates: validate an operator's `--starts`/`--ends` and write them to the season with the
// given name. Validation lives here (business logic) so the CLI stays thin glue.

import { badRequest, isIsoDate, ok, type IsoDate, type Result } from "@matchday/domain";
import type { setSeasonDatesByName, SeasonDatesWrite as SeasonDatesDbWrite } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonDateServiceDeps = {
  setSeasonDatesByName: WithoutDb<typeof setSeasonDatesByName>;
};

/** The outcome of a `set-dates` attempt: the validated dates on success, or why nothing was
 * written, so the CLI can report "no such season" and "ambiguous" distinctly. */
export type SeasonDatesWrite =
  | { status: "written"; seasonName: string; startsOn: IsoDate; endsOn: IsoDate }
  | { status: "missing" }
  | { status: "ambiguous"; count: number };

/** Set a season's dates, rejecting a malformed or reversed range before the write. Reports
 * `missing`/`ambiguous` rather than silently no-op'ing on a name that isn't a single season. */
export async function setSeasonDates(
  deps: SeasonDateServiceDeps,
  seasonName: string,
  startsOn: string,
  endsOn: string,
): Promise<Result<SeasonDatesWrite>> {
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) {
    return badRequest("Dates must be YYYY-MM-DD, e.g. --starts 2026-03-01 --ends 2026-09-30");
  }
  if (endsOn < startsOn) {
    return badRequest(`--ends (${endsOn}) is before --starts (${startsOn})`);
  }

  const written = await deps.setSeasonDatesByName(seasonName, startsOn, endsOn);
  if (!written.ok) {
    return written;
  }
  return ok(toSeasonDatesWrite(written.value, startsOn, endsOn));
}

/** Lift the data-access outcome into the CLI-facing shape, swapping the raw season row for the
 * validated dates the operator typed. */
function toSeasonDatesWrite(
  outcome: SeasonDatesDbWrite,
  startsOn: IsoDate,
  endsOn: IsoDate,
): SeasonDatesWrite {
  switch (outcome.status) {
    case "written":
      return { status: "written", seasonName: outcome.season.name, startsOn, endsOn };
    case "missing":
      return { status: "missing" };
    case "ambiguous":
      return { status: "ambiguous", count: outcome.count };
  }
}
