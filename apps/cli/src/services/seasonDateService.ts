// Season dates: validate an operator's `--starts`/`--ends` and write them to a competition's
// season window. Validation and resolution live here (business logic) so the CLI stays thin glue.

import {
  badRequest,
  isIsoDate,
  ok,
  type IsoDate,
  type Result,
  type Source,
} from "@matchday/domain";
import type {
  findCompetitionsForSeasonByName,
  findSeasonByName,
  updateCompetitionSeasonDates,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonDateServiceDeps = {
  findSeasonByName: WithoutDb<typeof findSeasonByName>;
  findCompetitionsForSeasonByName: WithoutDb<typeof findCompetitionsForSeasonByName>;
  updateCompetitionSeasonDates: WithoutDb<typeof updateCompetitionSeasonDates>;
};

export type SetSeasonDatesInput = {
  source: Source;
  seasonName: string;
  competitionName: string;
  startsOn: string;
  endsOn: string;
};

export type SeasonDatesCandidate = { id: string; name: string };

/** The outcome of a `set-dates` attempt: the validated window on success, or why nothing was
 * written, so the CLI can report a missing or ambiguous season or competition distinctly. */
export type SeasonDatesWrite =
  | {
      status: "written";
      source: Source;
      seasonName: string;
      competitionName: string;
      startsOn: IsoDate;
      endsOn: IsoDate;
    }
  | { status: "missing-season" }
  | { status: "missing-competition" }
  | { status: "ambiguous-competition"; candidates: SeasonDatesCandidate[] };

/** Set a competition's season window, rejecting a malformed or reversed range before the write.
 * The season and competition are resolved by name from the source, and the competition is limited
 * to ones that already run that season — so a window is never created for a competition that never
 * ran it. A name matching nothing, or more than one competition, is reported rather than
 * silently no-op'ing. */
export async function setSeasonDates(
  deps: SeasonDateServiceDeps,
  input: SetSeasonDatesInput,
): Promise<Result<SeasonDatesWrite>> {
  const { source, seasonName, competitionName, startsOn, endsOn } = input;

  if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) {
    return badRequest("Dates must be YYYY-MM-DD, e.g. --starts 2026-03-01 --ends 2026-09-30");
  }
  if (endsOn < startsOn) {
    return badRequest(`--ends (${endsOn}) is before --starts (${startsOn})`);
  }

  const seasonResult = await deps.findSeasonByName(source, seasonName);
  if (!seasonResult.ok) {
    return seasonResult;
  }
  if (seasonResult.value === null) {
    return ok({ status: "missing-season" });
  }
  const seasonId = seasonResult.value.id;

  const competitionsResult = await deps.findCompetitionsForSeasonByName(seasonId, competitionName);
  if (!competitionsResult.ok) {
    return competitionsResult;
  }
  if (competitionsResult.value.length === 0) {
    return ok({ status: "missing-competition" });
  }
  if (competitionsResult.value.length > 1) {
    return ok({
      status: "ambiguous-competition",
      candidates: competitionsResult.value.map((row) => ({ id: row.id, name: row.name })),
    });
  }

  const updated = await deps.updateCompetitionSeasonDates({
    competitionId: competitionsResult.value[0].id,
    seasonId,
    startsOn,
    endsOn,
  });
  if (!updated.ok) {
    return updated;
  }
  if (updated.value === null) {
    return ok({ status: "missing-competition" });
  }

  return ok({ status: "written", source, seasonName, competitionName, startsOn, endsOn });
}

export type SeasonDatesFailure = { message: string; hint: string };

/** The operator-facing reason a `set-dates` run wrote nothing, plus the next step. Kept out of the
 * CLI action so its branching stays flat. */
export function describeSeasonDatesFailure(
  outcome: Exclude<SeasonDatesWrite, { status: "written" }>,
  source: Source,
  seasonName: string,
  competitionName: string,
): SeasonDatesFailure {
  switch (outcome.status) {
    case "missing-season":
      return {
        message: `No ${source} season named "${seasonName}"`,
        hint: "run `mday catalog` first, or `mday season list` to see what exists",
      };
    case "missing-competition":
      return {
        message: `No competition named "${competitionName}" runs ${source} season "${seasonName}"`,
        hint: "run `mday catalog` for this season, or `mday season list` to see its competitions",
      };
    case "ambiguous-competition":
      return {
        message: `More than one competition is named "${competitionName}" in ${source} season "${seasonName}"`,
        // AGENTS.md: ambiguous input fails listing the candidates, never silently picks one.
        hint: `candidates: ${outcome.candidates.map((row) => `${row.name} (${row.id})`).join(", ")}`,
      };
  }
}
