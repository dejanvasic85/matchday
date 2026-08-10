// API token authentication (ADR 0013): resolves the client behind a request's `Authorization`
// header. Pure business logic (AGENTS.md) — the header is hashed and looked up, never compared
// as plaintext. Every *credential* failure (missing header, unknown token, revoked token) maps to
// the same `Unauthorized` error so the transport layer cannot leak which case applied. A failing
// token lookup is a `ServerError` instead: an unreachable database must surface as a logged 500,
// never as "your token is bad".

import {
  hashApiToken,
  ok,
  parseId,
  serverError,
  unauthorized,
  type ClientId,
  type Result,
} from "@matchday/domain";
import { findApiTokenByHash, type Db } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ApiTokenAuthDeps = {
  findApiTokenByHash: WithoutDb<typeof findApiTokenByHash>;
};

/** Wires the real data-access function to a live `db` — the only place this middleware's
 * transport layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the
 * logic). */
export function createApiTokenAuthDeps(db: Db): ApiTokenAuthDeps {
  return { findApiTokenByHash: (tokenHash) => findApiTokenByHash(db, tokenHash) };
}

const bearerPrefixValue = "Bearer ";
const unauthorizedMessageValue = "Invalid or missing API token";

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
    return unauthorized(unauthorizedMessageValue);
  }

  const tokenHash = await hashApiToken(token);
  const found = await deps.findApiTokenByHash(tokenHash);
  if (!found.ok) {
    return found;
  }
  if (found.value === null || found.value.revokedAt !== null) {
    return unauthorized(unauthorizedMessageValue);
  }

  const clientId = parseId(found.value.clientId, "client");
  if (clientId === undefined) {
    return serverError(
      `Api token row's client id "${found.value.clientId}" doesn't have the expected "cli_" prefix`,
    );
  }
  return ok(clientId);
}
