// List-clients job (0013): transport glue (AGENTS.md) — builds the real DB client and delegates
// roster assembly to the service.

import { type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  listApiTokens,
  listClients,
  listSubscriptionsWithLeague,
} from "@matchday/db";
import type { CliConfig } from "../config.ts";
import { listClientSummaries, type ClientSummary } from "../services/clientService.ts";

export type RunListClientsJobInput = {
  logger: Logger;
  config: CliConfig;
};

export async function runListClientsJob(
  input: RunListClientsJobInput,
): Promise<Result<ClientSummary[]>> {
  const { logger, config } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await listClientSummaries({
    listClients: () => listClients(db),
    listApiTokens: () => listApiTokens(db),
    listSubscriptionsWithLeague: () => listSubscriptionsWithLeague(db),
  });

  if (result.ok) {
    logger.debug("client.listed", "listed clients", { count: result.value.length });
  }

  return result;
}
