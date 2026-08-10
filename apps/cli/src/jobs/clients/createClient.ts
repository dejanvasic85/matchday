// Create-client job (0013): transport glue (AGENTS.md) — builds the real DB client and delegates
// creation to the service.

import { type ClientId, type Logger, type Result } from "@matchday/domain";
import { createDbClient, upsertClientByName } from "@matchday/db";
import type { CliConfig } from "../../config.ts";
import { createClient } from "../../services/clientResolver.ts";

export type RunCreateClientJobInput = {
  logger: Logger;
  config: CliConfig;
  name: string;
};

export async function runCreateClientJob(
  input: RunCreateClientJobInput,
): Promise<Result<ClientId>> {
  const { logger, config, name } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await createClient(
    { upsertClientByName: (values) => upsertClientByName(db, values) },
    name,
  );

  if (result.ok) {
    logger.info("client.created", "client created", { id: result.value, name });
  }

  return result;
}
