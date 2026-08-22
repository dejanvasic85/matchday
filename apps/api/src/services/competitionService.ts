// Competition service (0045): maps DB rows to the wire shape. Catalog data, open to any
// authenticated client, no subscription scoping (ADR 0013).

import { mapResult, requireFound, type Competition, type Result } from "@matchday/domain";
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

/** `Pick`, not `Omit`, so a new column stays off the wire until named here — and mapped
 * field-by-field below, since a spread would leak it regardless (#169). */
export type CompetitionResponse = Pick<Competition, "id" | "name"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToCompetitionResponse(competition: Competition): CompetitionResponse {
  return {
    id: competition.id,
    name: competition.name,
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
): Promise<Result<CompetitionResponse>> {
  const result = await deps.getCompetitionById(id);
  return requireFound(result, mapToCompetitionResponse, "Competition not found");
}
