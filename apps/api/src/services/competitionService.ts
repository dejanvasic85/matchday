// Competition service (0045): thin business logic over data access (AGENTS.md) — maps the DB row
// to the wire shape (timestamps as ISO strings) and lists/fetches competitions. Catalog data —
// open to any authenticated client, no subscription scoping (ADR 0013).

import { mapResult, type Competition, type Result } from "@matchday/domain";
import { getCompetitionById, listCompetitions, type Db } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type CompetitionServiceDeps = {
  listCompetitions: WithoutDb<typeof listCompetitions>;
  getCompetitionById: WithoutDb<typeof getCompetitionById>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createCompetitionServiceDeps(db: Db): CompetitionServiceDeps {
  return {
    listCompetitions: () => listCompetitions(db),
    getCompetitionById: (id) => getCompetitionById(db, id),
  };
}

export type CompetitionResponse = Omit<Competition, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToCompetitionResponse(competition: Competition): CompetitionResponse {
  return {
    ...competition,
    createdAt: competition.createdAt.toISOString(),
    updatedAt: competition.updatedAt.toISOString(),
  };
}

export async function listAllCompetitions(
  deps: Pick<CompetitionServiceDeps, "listCompetitions">,
): Promise<Result<CompetitionResponse[]>> {
  const result = await deps.listCompetitions();
  return mapResult(result, (competitions) => competitions.map(mapToCompetitionResponse));
}

export async function getCompetition(
  deps: Pick<CompetitionServiceDeps, "getCompetitionById">,
  id: string,
): Promise<Result<CompetitionResponse | null>> {
  const result = await deps.getCompetitionById(id);
  return mapResult(result, (competition) =>
    competition === null ? null : mapToCompetitionResponse(competition),
  );
}
