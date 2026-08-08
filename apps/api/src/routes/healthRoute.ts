// GET /health — thin transport glue (AGENTS.md): builds the real db client, delegates the
// readiness decision to healthService, and maps the Result to a status code.

import { createConsoleLogger, type Logger } from "@matchday/domain";
import { createDbClient, pingDb } from "@matchday/db";
import { Hono } from "hono";
import { getApiConfig, type ApiBindings } from "../config.ts";
import { checkHealth } from "../services/healthService.ts";

export const healthRoute = new Hono<{ Bindings: ApiBindings }>();

healthRoute.get("/", async (c) => {
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await checkHealth({ pingDb: () => pingDb(db) });

  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.health.failed", result.error.message, { cause: result.error.cause });
    return c.json({ status: "degraded" }, 503);
  }

  return c.json(result.value, 200);
});
