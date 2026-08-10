// API token data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md) — token generation/hashing is a service concern. Driver errors are
// captured into `err` rather than thrown.

import { ok, serverError, type Result } from "@matchday/domain";
import { eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { runQuery } from "./runQuery.ts";
import { apiToken } from "./schema.ts";

type ApiToken = typeof apiToken.$inferSelect;
type ApiTokenInsert = typeof apiToken.$inferInsert;

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

export async function listApiTokensByClientId(
  db: Db,
  clientId: string,
): Promise<Result<ApiToken[]>> {
  return runQuery(
    () => db.select().from(apiToken).where(eq(apiToken.clientId, clientId)),
    "Failed to list api tokens by client id",
  );
}

/** Every token across all clients. Not client-scoped: `client list` renders the whole roster in
 * one pass, so it counts these by `clientId` itself rather than issuing a query per client. The
 * `token_hash` is deliberately not selected — nothing outside request-time auth needs it. */
export async function listApiTokens(
  db: Db,
): Promise<Result<{ id: string; clientId: string; revokedAt: Date | null }[]>> {
  return runQuery(
    () =>
      db
        .select({ id: apiToken.id, clientId: apiToken.clientId, revokedAt: apiToken.revokedAt })
        .from(apiToken),
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
