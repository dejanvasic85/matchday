// API token data access: build/execute a query, return a `Result` of rows. No business rules
// here — token generation/hashing is a service concern.

import { ok, serverError, type Result } from "@matchday/domain";
import { desc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery } from "#runQuery.ts";
import { apiToken } from "#schema.ts";

type ApiToken = typeof apiToken.$inferSelect;
type ApiTokenInsert = typeof apiToken.$inferInsert;

/** Everything a token row says about itself apart from the secret: enough to report who owns it,
 * whether it still works, how old it is and when it was last used. */
const apiTokenSummaryColumnsValue = {
  id: apiToken.id,
  clientId: apiToken.clientId,
  revokedAt: apiToken.revokedAt,
  lastUsedAt: apiToken.lastUsedAt,
  createdAt: apiToken.createdAt,
} as const;

export type ApiTokenSummary = {
  id: string;
  clientId: string;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function insertApiToken(db: Db, values: ApiTokenInsert): Promise<Result<ApiToken>> {
  const result = await runQuery(
    () => db.insert(apiToken).values(values).returning(),
    "Failed to insert api token",
  );
  if (!result.ok) {
    return result;
  }
  const row = result.value[0];
  if (row === undefined) {
    return serverError("Insert of api token returned no row", values);
  }
  return ok(row);
}

/** Look up a token by its hash, for request-time auth — the caller checks `revokedAt` itself. */
export async function findApiTokenByHash(
  db: Db,
  tokenHash: string,
): Promise<Result<ApiToken | null>> {
  const result = await runQuery(
    () => db.select().from(apiToken).where(eq(apiToken.tokenHash, tokenHash)).limit(1),
    "Failed to find api token by hash",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** One client's tokens, newest first, for `mday client tokens`. The `token_hash` is deliberately
 * not selected — nothing outside request-time auth needs it. */
export async function listApiTokensByClientId(
  db: Db,
  clientId: string,
): Promise<Result<ApiTokenSummary[]>> {
  return runQuery(
    () =>
      db
        .select(apiTokenSummaryColumnsValue)
        .from(apiToken)
        .where(eq(apiToken.clientId, clientId))
        .orderBy(desc(apiToken.createdAt)),
    "Failed to list api tokens by client id",
  );
}

/** Every token across all clients. Not client-scoped: `client list` renders the whole roster in
 * one pass, so it counts these by `clientId` itself rather than issuing a query per client. */
export async function listApiTokens(db: Db): Promise<Result<ApiTokenSummary[]>> {
  return runQuery(
    () => db.select(apiTokenSummaryColumnsValue).from(apiToken),
    "Failed to list api tokens",
  );
}

export async function revokeApiToken(db: Db, id: string): Promise<Result<ApiToken | null>> {
  const result = await runQuery(
    () =>
      db
        .update(apiToken)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiToken.id, id))
        .returning(),
    "Failed to revoke api token",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Stamps a token's last authenticated use. Called off the request's critical path and only when
 * the stored value is stale, so an active token costs one write an hour, not one per request. */
export async function touchApiTokenLastUsed(
  db: Db,
  id: string,
  usedAt: Date,
): Promise<Result<void>> {
  // `updatedAt` deliberately untouched: a usage ping is not an edit to the token itself, and
  // bumping it hourly would hide when the token was actually issued or revoked.
  const result = await runQuery(
    () => db.update(apiToken).set({ lastUsedAt: usedAt }).where(eq(apiToken.id, id)),
    "Failed to update api token last used at",
  );
  return result.ok ? ok(undefined) : result;
}
