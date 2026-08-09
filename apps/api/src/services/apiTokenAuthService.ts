// API token authentication (ADR 0013): resolves the client behind a request's `Authorization`
// header. Pure business logic (AGENTS.md) — the header is hashed and looked up, never compared
// as plaintext. Every failure mode (missing header, unknown token, revoked token) maps to the
// same generic error; the transport layer turns any failure into a single 401, so as not to leak
// which case applied.

import { err, hashApiToken, ok, parseId, type ClientId, type Result } from "@matchday/domain";
import type { findApiTokenByHash } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ApiTokenAuthDeps = {
  findApiTokenByHash: WithoutDb<typeof findApiTokenByHash>;
};

const bearerPrefixValue = "Bearer ";
const unauthorizedError = err({ message: "Invalid or missing API token" });

function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (authorizationHeader === undefined || !authorizationHeader.startsWith(bearerPrefixValue)) {
    return undefined;
  }
  const token = authorizationHeader.slice(bearerPrefixValue.length).trim();
  return token === "" ? undefined : token;
}

export async function authenticateApiToken(
  deps: ApiTokenAuthDeps,
  authorizationHeader: string | undefined,
): Promise<Result<ClientId>> {
  const token = parseBearerToken(authorizationHeader);
  if (token === undefined) {
    return unauthorizedError;
  }

  const tokenHash = await hashApiToken(token);
  const found = await deps.findApiTokenByHash(tokenHash);
  if (!found.ok) {
    return found;
  }
  if (found.value === null || found.value.revokedAt !== null) {
    return unauthorizedError;
  }

  const clientId = parseId(found.value.clientId, "client");
  if (clientId === undefined) {
    return err({
      message: `Api token row's client id "${found.value.clientId}" doesn't have the expected "cli_" prefix`,
    });
  }
  return ok(clientId);
}
