// Single place a `Db` is constructed from request config, so downstream code just reads
// `c.get("db")` instead of repeating `getApiConfig` + `createDbClient`.

import { createDbClient, type Db } from "@matchday/db";
import { createMiddleware } from "hono/factory";
import { getApiConfig, type ApiBindings } from "#config.ts";

export type DbVariables = { db: Db };

export const dbClientMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: DbVariables;
}>(async (c, next) => {
  const config = getApiConfig(c.env);
  c.set("db", createDbClient(config.DATABASE_URL));
  await next();
});
