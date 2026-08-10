// List-clients job (0013): transport glue (AGENTS.md) — builds the real DB client and delegates
// roster assembly to the service.

import { type Result } from "@matchday/domain";
import {
  createDbClient,
  listApiTokens,
  listClients,
  listSubscriptionsWithLeague,
} from "@matchday/db";
import type { CliConfig } from "@/src/config.ts";
import { listClientSummaries, type ClientSummary } from "@/src/services/clientService.ts";

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
    listSubscriptionsWithLeague: () => listSubscriptionsWithLeague(db),
  });
}
