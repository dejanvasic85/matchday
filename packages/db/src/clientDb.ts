// Client data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runUpsert } from "./runQuery.ts";
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
