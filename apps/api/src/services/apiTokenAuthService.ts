// API token authentication, plus the last-use stamp that tells us whether a token is still
// live. Every *credential* failure maps to the same `Unauthorized` error so the transport can't
// leak which case applied; a failed lookup is `ServerError` instead.

import {
  hashApiToken,
  ok,
  parseId,
  serverError,
  unauthorized,
  type ApiTokenId,
  type ClientId,
  type Result,
} from "@matchday/domain";
import { findApiTokenByHash, touchApiTokenLastUsed, type Db } from "@matchday/db";
import { apiTokenUsageValue } from "#constants.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ApiTokenAuthDeps = {
  findApiTokenByHash: WithoutDb<typeof findApiTokenByHash>;
  touchApiTokenLastUsed: WithoutDb<typeof touchApiTokenLastUsed>;
};

/** The authenticated caller, plus what `recordApiTokenUse` needs to decide whether this request
 * is worth a write. */
export type AuthenticatedApiToken = {
  clientId: ClientId;
  tokenId: ApiTokenId;
  lastUsedAt: Date | null;
};

/** Wires the real data-access function to a live `db` — the only place this middleware's
 * transport layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the
 * logic). */
export function createApiTokenAuthDeps(db: Db): ApiTokenAuthDeps {
  return {
    findApiTokenByHash: (tokenHash) => findApiTokenByHash(db, tokenHash),
    touchApiTokenLastUsed: (id, usedAt) => touchApiTokenLastUsed(db, id, usedAt),
  };
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
  deps: Pick<ApiTokenAuthDeps, "findApiTokenByHash">,
  authorizationHeader: string | undefined,
): Promise<Result<AuthenticatedApiToken>> {
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

  const tokenId = parseId(found.value.id, "apiToken");
  if (tokenId === undefined) {
    return serverError(
      `Api token row's id "${found.value.id}" doesn't have the expected "tok_" prefix`,
    );
  }

  return ok({ clientId, tokenId, lastUsedAt: found.value.lastUsedAt });
}

/** True once the stored stamp is older than the window, or the token has never been used. */
function isUsageStampDue(lastUsedAt: Date | null, now: Date): boolean {
  return (
    lastUsedAt === null || now.getTime() - lastUsedAt.getTime() >= apiTokenUsageValue.recordWindowMs
  );
}

/**
 * Stamps the token's last use, skipping the write while the stored stamp is still inside the
 * window. Run this off the response path: a failed stamp costs us a stale date, never a request.
 */
export async function recordApiTokenUse(
  deps: Pick<ApiTokenAuthDeps, "touchApiTokenLastUsed">,
  authenticated: AuthenticatedApiToken,
  now: Date,
): Promise<Result<void>> {
  if (!isUsageStampDue(authenticated.lastUsedAt, now)) {
    return ok(undefined);
  }
  return deps.touchApiTokenLastUsed(authenticated.tokenId, now);
}
