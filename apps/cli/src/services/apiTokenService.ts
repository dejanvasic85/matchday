// API token issuance/revocation (ADR 0013): persists only the token's hash — the plaintext is
// returned once and never stored, so it can't be recovered later, only rotated.

import {
  generateApiToken,
  generateId,
  hashApiToken,
  notFound,
  ok,
  type ApiTokenId,
  type Result,
} from "@matchday/domain";
import type { insertApiToken, revokeApiToken } from "@matchday/db";
import { resolveClient, type ClientResolverDeps } from "#services/clientResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ApiTokenServiceDeps = ClientResolverDeps & {
  insertApiToken: WithoutDb<typeof insertApiToken>;
  revokeApiToken: WithoutDb<typeof revokeApiToken>;
};

export type CreatedApiToken = {
  id: ApiTokenId;
  /** Plaintext token — only ever available here. Only its hash is persisted. */
  token: string;
};

export async function createApiToken(
  deps: Pick<ApiTokenServiceDeps, "findClientByName" | "insertApiToken">,
  clientName: string,
): Promise<Result<CreatedApiToken>> {
  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const token = generateApiToken();
  const tokenHash = await hashApiToken(token);
  const id = generateId("apiToken");
  const inserted = await deps.insertApiToken({ id, clientId: clientResult.value, tokenHash });
  if (!inserted.ok) {
    return inserted;
  }

  return ok({ id, token });
}

export async function revokeApiTokenById(
  deps: Pick<ApiTokenServiceDeps, "revokeApiToken">,
  id: ApiTokenId,
): Promise<Result<void>> {
  const revoked = await deps.revokeApiToken(id);
  if (!revoked.ok) {
    return revoked;
  }
  if (revoked.value === null) {
    return notFound(`Api token not found: ${id}`);
  }
  return ok(undefined);
}
