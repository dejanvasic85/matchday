// List-clients job: transport glue (AGENTS.md) — builds the real DB client and delegates
// roster assembly to the service.

import { type Result } from "@matchday/domain";
import {
  createDbClient,
  listApiTokens,
  listClientClubs,
  listClients,
  listSubscriptionsWithLeague,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listClientSummaries, type ClientSummary } from "#services/clientService.ts";

export type RunListClientsJobInput = {
  config: CliConfig;
};

// No success logging: this job's output *is* the roster the CLI prints, so a log line would just
// be noise interleaved with the table on stdout. Failures are logged by the caller.
export async function runListClientsJob(
  input: RunListClientsJobInput,
): Promise<Result<ClientSummary[]>> {
  const { config } = input;

  const db = createDbClient(config.DATABASE_URL);
  return listClientSummaries({
    listClients: () => listClients(db),
    listApiTokens: () => listApiTokens(db),
    listClientClubs: () => listClientClubs(db),
    listSubscriptionsWithLeague: (filter) => listSubscriptionsWithLeague(db, filter),
  });
}
