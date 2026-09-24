// Season dates: validate an operator's `--starts`/`--ends` and write them to the season with the
// given name. Validation lives here (business logic) so the CLI stays thin glue.

import {
  badRequest,
  hasSeasonFinished,
  isIsoDate,
  ok,
  type IsoDate,
  type Result,
} from "@matchday/domain";
import type { setSeasonDatesByName } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonDateServiceDeps = {
  setSeasonDatesByName: WithoutDb<typeof setSeasonDatesByName>;
};

export type SeasonDates = {
  seasonName: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
};

/**
 * Set a season's start and end dates. Both are required: a half-known window can't answer "is
 * this season current?" from either end, so we reject it rather than store a partial range.
 *
 * `endsOn` before `startsOn` is a typo, not a zero-length season, so it fails before the write.
 * An unknown season name returns `null` — the job reports "no such season" rather than exiting 0.
 */
export async function setSeasonDates(
  deps: SeasonDateServiceDeps,
  seasonName: string,
  startsOn: string,
  endsOn: string,
): Promise<Result<SeasonDates | null>> {
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) {
    return badRequest("Dates must be YYYY-MM-DD, e.g. --starts 2026-03-01 --ends 2026-09-30");
  }
  if (hasSeasonFinished(endsOn, startsOn)) {
    return badRequest(`--ends (${endsOn}) is before --starts (${startsOn})`);
  }

  const written = await deps.setSeasonDatesByName(seasonName, startsOn, endsOn);
  if (!written.ok) {
    return written;
  }
  if (written.value === null) {
    return ok(null);
  }

  return ok({ seasonName: written.value.name, startsOn, endsOn });
}
