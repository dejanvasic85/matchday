import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "#schema.ts";

/**
 * Build a Drizzle client over the Neon serverless (neon-http) driver — safe inside a V8 isolate,
 * per ADR 0009 (never a raw pg TCP connection from a Worker). Injected as a dependency: services
 * and jobs receive the returned client by argument so tests can pass a fake.
 *
 * neon-http supports single-shot and batched queries, not interactive transactions (ADR 0011).
 */
export function createDbClient(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle({ client: sql, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDbClient>;
