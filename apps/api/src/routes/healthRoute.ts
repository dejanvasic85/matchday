// GET /health — thin transport glue (AGENTS.md): reads the request's `db` (set by
// dbClientMiddleware), delegates the readiness decision to healthService, and maps the Result to
// a status code.

import { createConsoleLogger, type Logger } from "@matchday/domain";
import { Hono } from "hono";
import type { ApiBindings } from "#config.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import { checkHealth, createCheckHealthDeps } from "#services/healthService.ts";

export const healthRoute = new Hono<{ Bindings: ApiBindings; Variables: DbVariables }>();

healthRoute.get("/", async (c) => {
  const result = await checkHealth(createCheckHealthDeps(c.get("db")));

  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.health.failed", result.error.message, { cause: result.error.cause });
    return c.json({ status: "degraded" }, 503);
  }

  return c.json(result.value, 200);
});
