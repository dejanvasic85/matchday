// Create-api-token job: transport glue (AGENTS.md) — builds the real DB client and
// delegates client resolution + token minting to the service.

import { type Logger, type Result } from "@matchday/domain";
import { createDbClient, findClientByName, insertApiToken } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { createApiToken, type CreatedApiToken } from "#services/apiTokenService.ts";

export type RunCreateApiTokenJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
};

export async function runCreateApiTokenJob(
  input: RunCreateApiTokenJobInput,
): Promise<Result<CreatedApiToken>> {
  const { logger, config, clientName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await createApiToken(
    {
      findClientByName: (name) => findClientByName(db, name),
      insertApiToken: (values) => insertApiToken(db, values),
    },
    clientName,
  );

  if (result.ok) {
    logger.info("apitoken.created", "api token created", { id: result.value.id, clientName });
  }

  return result;
}
