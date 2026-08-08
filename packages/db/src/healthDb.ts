// Health-check data access: a trivial round-trip proving the caller can reach Postgres. No
// business rules here (AGENTS.md).

import { ok, type Result } from "@matchday/domain";
import { sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { runQuery } from "./runQuery.ts";

export async function pingDb(db: Db): Promise<Result<void>> {
  const result = await runQuery(() => db.execute(sql`select 1`), "Failed to ping database");
  return result.ok ? ok(undefined) : result;
}
