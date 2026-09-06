// List-api-token-usage job: transport glue (AGENTS.md) — builds the real DB client and
// delegates the client lookup and usage report to the service.

import { type Result } from "@matchday/domain";
import { createDbClient, findClientByName, listApiTokensByClientId } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listApiTokenUsage, type ApiTokenUsage } from "#services/apiTokenService.ts";

export type RunListApiTokenUsageJobInput = {
  config: CliConfig;
  clientName: string;
};

// No success logging: this job's output *is* the table the CLI prints. Failures are logged by
// the caller.
export async function runListApiTokenUsageJob(
  input: RunListApiTokenUsageJobInput,
): Promise<Result<ApiTokenUsage[]>> {
  const { config, clientName } = input;

  const db = createDbClient(config.DATABASE_URL);
  return listApiTokenUsage(
    {
      findClientByName: (name) => findClientByName(db, name),
      listApiTokensByClientId: (clientId) => listApiTokensByClientId(db, clientId),
    },
    clientName,
    new Date(),
  );
}
