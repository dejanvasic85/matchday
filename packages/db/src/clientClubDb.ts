// Client-club data access: build a query, execute it, return a `Result` of rows. No business
// rules here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { client, clientClub, club } from "#schema.ts";

type ClientClub = typeof clientClub.$inferSelect;
type ClientClubInsert = typeof clientClub.$inferInsert;

/** A followed club joined to its name — what `mday client list-clubs` renders, so the operator
 * sees "Williamstown SC" rather than a bare `clb_` id. */
export type ClientClubWithClub = {
  id: string;
  clientId: string;
  clubId: string;
  clubName: string;
  /** Listings show whether a webhook is configured, never the secret. */
  webhookUrl: string | null;
};

/**
 * Upsert a follow by its `(client_id, club_id)` key: a client follows a club at most once, so
 * re-running `follow-club` is idempotent. The conflict branch deliberately leaves `webhook_url`
 * and `webhook_secret` untouched — re-following must never wipe an already-configured webhook,
 * which is only changed through `setClientClubWebhook`.
 */
export async function upsertClientClub(
  db: Db,
  values: ClientClubInsert,
): Promise<Result<ClientClub>> {
  return runUpsert(
    () =>
      db
        .insert(clientClub)
        .values(values)
        .onConflictDoUpdate({
          target: [clientClub.clientId, clientClub.clubId],
          set: { updatedAt: new Date() },
        })
        .returning(),
    "client club",
    values,
  );
}

/** Every follow with its club's name, club-ordered. Not client-scoped: `client list` renders the
 * whole roster in one pass, so it groups these by `clientId` itself rather than issuing a query
 * per client. */
export async function listClientClubs(db: Db): Promise<Result<ClientClubWithClub[]>> {
  return runQuery(
    () =>
      db
        .select({
          id: clientClub.id,
          clientId: clientClub.clientId,
          clubId: clientClub.clubId,
          clubName: club.name,
          webhookUrl: clientClub.webhookUrl,
        })
        .from(clientClub)
        .innerJoin(club, eq(clientClub.clubId, club.id))
        .orderBy(asc(club.name)),
    "Failed to list client clubs",
  );
}

/** The clubs one client follows — the input `sync-subscriptions` derives its target league set
 * from. Client-scoped in SQL rather than by filtering a full dump (AGENTS.md). */
export async function listClientClubsByClientId(
  db: Db,
  clientId: string,
): Promise<Result<ClientClubWithClub[]>> {
  return runQuery(
    () =>
      db
        .select({
          id: clientClub.id,
          clientId: clientClub.clientId,
          clubId: clientClub.clubId,
          clubName: club.name,
          webhookUrl: clientClub.webhookUrl,
        })
        .from(clientClub)
        .innerJoin(club, eq(clientClub.clubId, club.id))
        .where(eq(clientClub.clientId, clientId))
        .orderBy(asc(club.name)),
    "Failed to list client clubs by client id",
  );
}

/** Look up one follow by its `(client_id, club_id)` key, or `null` when the client doesn't follow
 * that club — so webhook commands report "not followed" rather than silently doing nothing. */
export async function findClientClub(
  db: Db,
  clientId: string,
  clubId: string,
): Promise<Result<ClientClub | null>> {
  const result = await runQuery(
    () =>
      db
        .select()
        .from(clientClub)
        .where(and(eq(clientClub.clientId, clientId), eq(clientClub.clubId, clubId)))
        .limit(1),
    "Failed to find client club",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Hard-delete a follow, returning the removed row — or `null` when no such follow existed.
 * Unlike a subscription there's no soft delete: a follow carries no history worth reviving, and
 * the subscriptions it derived stay put until the next `sync-subscriptions` prunes them. */
export async function deleteClientClub(
  db: Db,
  clientId: string,
  clubId: string,
): Promise<Result<ClientClub | null>> {
  const result = await runQuery(
    () =>
      db
        .delete(clientClub)
        .where(and(eq(clientClub.clientId, clientId), eq(clientClub.clubId, clubId)))
        .returning(),
    "Failed to delete client club",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Set (or replace) a follow's webhook target + signing secret. Returns `null` when the client
 * doesn't follow that club. */
export async function setClientClubWebhook(
  db: Db,
  clientId: string,
  clubId: string,
  webhookUrl: string,
  webhookSecret: string,
): Promise<Result<ClientClub | null>> {
  const result = await runQuery(
    () =>
      db
        .update(clientClub)
        .set({ webhookUrl, webhookSecret, updatedAt: new Date() })
        .where(and(eq(clientClub.clientId, clientId), eq(clientClub.clubId, clubId)))
        .returning(),
    "Failed to set client club webhook",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Clear a follow's webhook (both URL and secret), returning the updated row — or `null` when the
 * client doesn't follow that club. */
export async function clearClientClubWebhook(
  db: Db,
  clientId: string,
  clubId: string,
): Promise<Result<ClientClub | null>> {
  const result = await runQuery(
    () =>
      db
        .update(clientClub)
        .set({ webhookUrl: null, webhookSecret: null, updatedAt: new Date() })
        .where(and(eq(clientClub.clientId, clientId), eq(clientClub.clubId, clubId)))
        .returning(),
    "Failed to clear client club webhook",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** A webhook delivery target — what the league crawl reads post-crawl to notify a club's
 * followers. Narrowed to webhook-configured follows only, so callers never branch on a null URL. */
export type ClientClubWebhook = {
  id: string;
  clientId: string;
  clientName: string;
  clubId: string;
  webhookUrl: string;
  webhookSecret: string;
};

/** Every webhook-configured follow for a set of clubs — the crawl's post-run notification
 * fan-out list for one league, whose clubs the caller resolves from `league_team` first. Returns
 * an empty list for no clubs rather than issuing a query with an empty `IN ()`. */
export async function listClientClubWebhooksForClubIds(
  db: Db,
  clubIds: string[],
): Promise<Result<ClientClubWebhook[]>> {
  if (clubIds.length === 0) {
    return ok([]);
  }

  const result = await runQuery(
    () =>
      db
        .select({
          id: clientClub.id,
          clientId: clientClub.clientId,
          clientName: client.name,
          clubId: clientClub.clubId,
          webhookUrl: clientClub.webhookUrl,
          webhookSecret: clientClub.webhookSecret,
        })
        .from(clientClub)
        .innerJoin(client, eq(clientClub.clientId, client.id))
        .where(
          and(
            inArray(clientClub.clubId, clubIds),
            isNotNull(clientClub.webhookUrl),
            isNotNull(clientClub.webhookSecret),
          ),
        ),
    "Failed to list client club webhooks for club ids",
  );
  if (!result.ok) {
    return result;
  }
  // The `isNotNull` filters above guarantee both are non-null in SQL, but Drizzle's column types
  // stay nullable — narrow here so callers get a clean type without an unsafe cast.
  return ok(
    result.value.flatMap((row) =>
      row.webhookUrl === null || row.webhookSecret === null
        ? []
        : [
            {
              id: row.id,
              clientId: row.clientId,
              clientName: row.clientName,
              clubId: row.clubId,
              webhookUrl: row.webhookUrl,
              webhookSecret: row.webhookSecret,
            },
          ],
    ),
  );
}
