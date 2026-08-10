// Client data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { runQuery, runUpsert } from "./runQuery.ts";
import { client } from "./schema.ts";

type Client = typeof client.$inferSelect;
type ClientInsert = typeof client.$inferInsert;

/**
 * Upsert a client by its `name` key in one round trip (rather than find-then-insert, which would
 * race two concurrent callers creating the same new client): re-adding a known name returns the
 * existing row untouched bar `updatedAt`.
 */
export async function upsertClientByName(db: Db, values: ClientInsert): Promise<Result<Client>> {
  return runUpsert(
    () =>
      db
        .insert(client)
        .values(values)
        .onConflictDoUpdate({
          target: client.name,
          set: { updatedAt: new Date() },
        })
        .returning(),
    "client",
    values,
  );
}

/** Every client, name-ordered — the `mday client list` roster. */
export async function listClients(db: Db): Promise<Result<Client[]>> {
  return runQuery(
    () => db.select().from(client).orderBy(asc(client.name)),
    "Failed to list clients",
  );
}

/** Look up a client by its unique `name` key, without creating one — the read-only counterpart to
 * {@link upsertClientByName}, for commands that must fail on an unknown client rather than
 * silently spawning a new tenant off a typo. */
export async function findClientByName(db: Db, name: string): Promise<Result<Client | null>> {
  const result = await runQuery(
    () => db.select().from(client).where(eq(client.name, name)).limit(1),
    "Failed to find client by name",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
