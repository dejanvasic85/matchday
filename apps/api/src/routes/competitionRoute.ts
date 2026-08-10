// Competition routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param,
// the service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createConsoleLogger, type Logger } from "@matchday/domain";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { competitionResponseSchema } from "@/schemas/competitionSchema.ts";
import { errorSchema } from "@/schemas/errorSchema.ts";
import { idParamSchema } from "@/schemas/idParamSchema.ts";
import {
  createCompetitionServiceDeps,
  getCompetition,
  listAllCompetitions,
} from "@/services/competitionService.ts";

export const competitionRoute = new OpenAPIHono<{
  Bindings: ApiBindings;
  Variables: DbVariables;
}>();

const listCompetitionsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Competitions"],
  summary: "List all competitions",
  responses: {
    200: {
      description: "The full competition catalog",
      content: { "application/json": { schema: competitionResponseSchema.array() } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

competitionRoute.openapi(listCompetitionsRoute, async (c) => {
  const result = await listAllCompetitions(createCompetitionServiceDeps(c.get("db")));
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.competition.list.failed", result.error.message, {
      cause: result.error.cause,
    });
    return c.json({ error: "Internal server error" }, 500);
  }
  return c.json(result.value, 200);
});

const getCompetitionRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Competitions"],
  summary: "Get a competition by id",
  request: { params: idParamSchema("competition", "cmp_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The competition",
      content: { "application/json": { schema: competitionResponseSchema } },
    },
    404: {
      description: "Competition not found",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

competitionRoute.openapi(getCompetitionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getCompetition(createCompetitionServiceDeps(c.get("db")), id);
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.competition.get.failed", result.error.message, {
      cause: result.error.cause,
    });
    return c.json({ error: "Internal server error" }, 500);
  }
  if (result.value === null) {
    return c.json({ error: "Competition not found" }, 404);
  }
  return c.json(result.value, 200);
});
