// Db client middleware (AGENTS.md: routes are glue, services own the logic) — the single place
// a `Db` is constructed from the request's config, so every route/middleware downstream just
// reads `c.get("db")` instead of each repeating `getApiConfig` + `createDbClient`.

import { createDbClient, type Db } from "@matchday/db";
import { createMiddleware } from "hono/factory";
import { getApiConfig, type ApiBindings } from "@/config.ts";

export type DbVariables = { db: Db };

export const dbClientMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: DbVariables;
}>(async (c, next) => {
  const config = getApiConfig(c.env);
  c.set("db", createDbClient(config.DATABASE_URL));
  await next();
});
