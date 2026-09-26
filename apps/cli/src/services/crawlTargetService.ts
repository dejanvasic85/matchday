// Crawl-target management: resolve an operator's competition and league names, then list, add or
// remove targets. Resolution is business logic, so the CLI stays thin glue (AGENTS.md).

import { generateId, ok, type Result, type Source } from "@matchday/domain";
import type {
  deleteCrawlTargetById,
  deleteCrawlTargetByLeague,
  findCompetitionsBySourceAndName,
  listCrawlTargets,
  listLeagueNamesByCompetitionId,
  upsertCrawlTarget,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type CrawlTargetServiceDeps = {
  findCompetitionsBySourceAndName: WithoutDb<typeof findCompetitionsBySourceAndName>;
  listLeagueNamesByCompetitionId: WithoutDb<typeof listLeagueNamesByCompetitionId>;
  upsertCrawlTarget: WithoutDb<typeof upsertCrawlTarget>;
  deleteCrawlTargetById: WithoutDb<typeof deleteCrawlTargetById>;
  deleteCrawlTargetByLeague: WithoutDb<typeof deleteCrawlTargetByLeague>;
  listCrawlTargets: WithoutDb<typeof listCrawlTargets>;
};

/** A flat row for `mday crawl-target list`, independent of display, so `--json` prints it unmodified. */
export type CrawlTargetSummary = {
  id: string;
  competitionId: string;
  competitionName: string;
  leagueName: string;
};

export type CrawlTargetCandidate = { id: string; name: string };

export type AddCrawlTargetOutcome =
  | {
      status: "added";
      id: string;
      competitionId: string;
      competitionName: string;
      leagueName: string;
    }
  | { status: "missing-competition" }
  | { status: "ambiguous-competition"; candidates: CrawlTargetCandidate[] }
  | { status: "missing-league" };

export type RemoveCrawlTargetOutcome =
  | { status: "removed"; id: string }
  | { status: "not-found" }
  | { status: "ambiguous-competition"; candidates: CrawlTargetCandidate[] };

export type AddCrawlTargetInput = {
  source: Source;
  competitionName: string;
  leagueName: string;
};

export type RemoveCrawlTargetByLeagueInput = {
  source: Source;
  competitionName: string;
  leagueName: string;
};

type CompetitionResolution =
  | { status: "resolved"; competitionId: string; competitionName: string }
  | { status: "missing" }
  | { status: "ambiguous"; candidates: CrawlTargetCandidate[] };

/** Find one competition by exact name in a source, or report that none or several matched. A name
 * matching more than one is never silently picked, so the operator always picks the right one. */
async function resolveCompetition(
  deps: Pick<CrawlTargetServiceDeps, "findCompetitionsBySourceAndName">,
  source: Source,
  name: string,
): Promise<Result<CompetitionResolution>> {
  const found = await deps.findCompetitionsBySourceAndName(source, name);
  if (!found.ok) {
    return found;
  }
  if (found.value.length === 0) {
    return ok({ status: "missing" });
  }
  if (found.value.length > 1) {
    return ok({
      status: "ambiguous",
      candidates: found.value.map((row) => ({ id: row.id, name: row.name })),
    });
  }
  return ok({
    status: "resolved",
    competitionId: found.value[0].id,
    competitionName: found.value[0].name,
  });
}

/**
 * Add a league to the crawl scope. The league name must already exist under the competition, so we
 * store the exact text the crawl will look up again rather than a typo that silently never matches.
 */
export async function addCrawlTarget(
  deps: Pick<
    CrawlTargetServiceDeps,
    "findCompetitionsBySourceAndName" | "listLeagueNamesByCompetitionId" | "upsertCrawlTarget"
  >,
  input: AddCrawlTargetInput,
): Promise<Result<AddCrawlTargetOutcome>> {
  const competition = await resolveCompetition(deps, input.source, input.competitionName);
  if (!competition.ok) {
    return competition;
  }
  switch (competition.value.status) {
    case "missing":
      return ok({ status: "missing-competition" });
    case "ambiguous":
      return ok({ status: "ambiguous-competition", candidates: competition.value.candidates });
    case "resolved":
      break;
  }
  const { competitionId, competitionName } = competition.value;

  const names = await deps.listLeagueNamesByCompetitionId(competitionId);
  if (!names.ok) {
    return names;
  }
  if (!names.value.includes(input.leagueName)) {
    return ok({ status: "missing-league" });
  }

  const upserted = await deps.upsertCrawlTarget({
    id: generateId("crawlTarget"),
    competitionId,
    leagueName: input.leagueName,
  });
  if (!upserted.ok) {
    return upserted;
  }
  return ok({
    status: "added",
    id: upserted.value.id,
    competitionId,
    competitionName,
    leagueName: input.leagueName,
  });
}

/** Remove a target by its id. A missing id reports "not found" rather than a silent no-op. */
export async function removeCrawlTargetById(
  deps: Pick<CrawlTargetServiceDeps, "deleteCrawlTargetById">,
  id: string,
): Promise<Result<RemoveCrawlTargetOutcome>> {
  const deleted = await deps.deleteCrawlTargetById(id);
  if (!deleted.ok) {
    return deleted;
  }
  return ok(
    deleted.value === null ? { status: "not-found" } : { status: "removed", id: deleted.value.id },
  );
}

/** Remove a target by its competition and league names. A competition that doesn't exist means no
 * target can match, so that reads as "not found"; an ambiguous competition fails listing candidates. */
export async function removeCrawlTargetByLeague(
  deps: Pick<
    CrawlTargetServiceDeps,
    "findCompetitionsBySourceAndName" | "deleteCrawlTargetByLeague"
  >,
  input: RemoveCrawlTargetByLeagueInput,
): Promise<Result<RemoveCrawlTargetOutcome>> {
  const competition = await resolveCompetition(deps, input.source, input.competitionName);
  if (!competition.ok) {
    return competition;
  }
  switch (competition.value.status) {
    case "missing":
      return ok({ status: "not-found" });
    case "ambiguous":
      return ok({ status: "ambiguous-competition", candidates: competition.value.candidates });
    case "resolved":
      break;
  }

  const deleted = await deps.deleteCrawlTargetByLeague(
    competition.value.competitionId,
    input.leagueName,
  );
  if (!deleted.ok) {
    return deleted;
  }
  return ok(
    deleted.value === null ? { status: "not-found" } : { status: "removed", id: deleted.value.id },
  );
}

/** Every target as a flat summary, names resolved for display. */
export async function listCrawlTargetsSummary(
  deps: Pick<CrawlTargetServiceDeps, "listCrawlTargets">,
): Promise<Result<CrawlTargetSummary[]>> {
  const result = await deps.listCrawlTargets();
  if (!result.ok) {
    return result;
  }
  return ok(
    result.value.map((row) => ({
      id: row.id,
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      leagueName: row.leagueName,
    })),
  );
}

export type CrawlTargetFailure = { message: string; hint: string };

/** The operator-facing reason an add wrote nothing, plus the next step. Kept out of the CLI action
 * so its branching stays flat. */
export function describeAddCrawlTargetFailure(
  outcome: Exclude<AddCrawlTargetOutcome, { status: "added" }>,
  source: Source,
  competitionName: string,
  leagueName: string,
): CrawlTargetFailure {
  switch (outcome.status) {
    case "missing-competition":
      return {
        message: `No ${source} competition named "${competitionName}"`,
        hint: "run `mday catalog` first, or check the exact name with `mday season list`",
      };
    case "ambiguous-competition":
      return {
        message: `More than one ${source} competition is named "${competitionName}"`,
        // AGENTS.md: ambiguous input fails listing the candidates, never silently picks one.
        hint: `candidates: ${outcome.candidates.map((row) => `${row.name} (${row.id})`).join(", ")}`,
      };
    case "missing-league":
      return {
        message: `No league named "${leagueName}" under ${source} competition "${competitionName}"`,
        hint: "run `mday catalog` for that competition, or check the exact league name",
      };
  }
}

/** The operator-facing reason a remove removed nothing, plus the next step. */
export function describeRemoveCrawlTargetFailure(
  outcome: Exclude<RemoveCrawlTargetOutcome, { status: "removed" }>,
  source: Source,
  competitionName: string,
  leagueName: string,
): CrawlTargetFailure {
  switch (outcome.status) {
    case "not-found":
      return {
        message: `No crawl target for "${leagueName}" under ${source} competition "${competitionName}"`,
        hint: "run `mday crawl-target list` to see what is in scope",
      };
    case "ambiguous-competition":
      return {
        message: `More than one ${source} competition is named "${competitionName}"`,
        hint: `candidates: ${outcome.candidates.map((row) => `${row.name} (${row.id})`).join(", ")}`,
      };
  }
}
