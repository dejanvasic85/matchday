// Revoke-api-token job (0013): transport glue (AGENTS.md) — builds the real DB client and
// delegates revocation to the service.

import { type ApiTokenId, type Logger, type Result } from "@matchday/domain";
import { createDbClient, revokeApiToken } from "@matchday/db";
import type { CliConfig } from "../../config.ts";
import { revokeApiTokenById } from "../../services/apiTokenService.ts";

export type RunRevokeApiTokenJobInput = {
  logger: Logger;
  config: CliConfig;
  id: ApiTokenId;
};

export async function runRevokeApiTokenJob(
  input: RunRevokeApiTokenJobInput,
): Promise<Result<void>> {
  const { logger, config, id } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await revokeApiTokenById(
    { revokeApiToken: (tokenId) => revokeApiToken(db, tokenId) },
    id,
  );

  if (result.ok) {
    logger.info("apitoken.revoked", "api token revoked", { id });
  }

  return result;
}
