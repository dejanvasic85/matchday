// API token issuance, revocation and usage reporting: persists only the token's hash — the
// plaintext is returned once and never stored, so it can't be recovered later, only rotated.

import {
  generateApiToken,
  generateId,
  hashApiToken,
  notFound,
  ok,
  type ApiTokenId,
  type Result,
} from "@matchday/domain";
import type { insertApiToken, listApiTokensByClientId, revokeApiToken } from "@matchday/db";
import { apiTokenLifecycleValue } from "#services/constants.ts";
import { resolveClient, type ClientResolverDeps } from "#services/clientResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ApiTokenServiceDeps = ClientResolverDeps & {
  insertApiToken: WithoutDb<typeof insertApiToken>;
  revokeApiToken: WithoutDb<typeof revokeApiToken>;
  listApiTokensByClientId: WithoutDb<typeof listApiTokensByClientId>;
};

/**
 * What a token is doing right now, so an operator can act without reading dates:
 * `revoked` — already dead; `unused` — issued but never authenticated a request, so it was
 * probably never rolled out; `idle` — worked once but nothing has called with it lately, the
 * candidate for removal; `active` — in use.
 */
export const apiTokenStatusValue = {
  revoked: "revoked",
  unused: "unused",
  idle: "idle",
  active: "active",
} as const;

export type ApiTokenStatus = (typeof apiTokenStatusValue)[keyof typeof apiTokenStatusValue];

export type ApiTokenUsage = {
  id: string;
  status: ApiTokenStatus;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  /** Whole days since the token was issued. */
  ageDays: number;
  /** Whole days since its last authenticated request; null when it has never been used. */
  idleDays: number | null;
  /** The token is old enough that the client should rotate it, even if it is still in use. */
  renewalDue: boolean;
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

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / apiTokenLifecycleValue.msPerDay);
}

function toStatus(
  revokedAt: Date | null,
  lastUsedAt: Date | null,
  idleDays: number | null,
): ApiTokenStatus {
  if (revokedAt !== null) {
    return apiTokenStatusValue.revoked;
  }
  if (lastUsedAt === null || idleDays === null) {
    return apiTokenStatusValue.unused;
  }
  return idleDays >= apiTokenLifecycleValue.idleAfterDays
    ? apiTokenStatusValue.idle
    : apiTokenStatusValue.active;
}

/**
 * One client's tokens with their usage worked out: how old each is, how long since it last
 * authenticated a request, and whether it is due for rotation. `now` is passed in so the
 * thresholds are testable.
 *
 * Last use is stamped by the API at most once an hour per token, so a date here can lag real
 * traffic by that much — it dates a token's use, it doesn't count it.
 */
export async function listApiTokenUsage(
  deps: Pick<ApiTokenServiceDeps, "findClientByName" | "listApiTokensByClientId">,
  clientName: string,
  now: Date,
): Promise<Result<ApiTokenUsage[]>> {
  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const tokens = await deps.listApiTokensByClientId(clientResult.value);
  if (!tokens.ok) {
    return tokens;
  }

  return ok(
    tokens.value.map((token) => {
      const idleDays = token.lastUsedAt === null ? null : wholeDaysBetween(token.lastUsedAt, now);
      const ageDays = wholeDaysBetween(token.createdAt, now);
      return {
        id: token.id,
        status: toStatus(token.revokedAt, token.lastUsedAt, idleDays),
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        revokedAt: token.revokedAt,
        ageDays,
        idleDays,
        renewalDue: token.revokedAt === null && ageDays >= apiTokenLifecycleValue.renewAfterDays,
      };
    }),
  );
}
