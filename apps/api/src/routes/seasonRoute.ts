// Season routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param, the
// service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createConsoleLogger, type Logger } from "@matchday/domain";
import { createDbClient, getSeasonById, listSeasons } from "@matchday/db";
import { getApiConfig, type ApiBindings } from "../config.ts";
import { errorSchema } from "../schemas/errorSchema.ts";
import { idParamSchema } from "../schemas/idParamSchema.ts";
import { seasonResponseSchema } from "../schemas/seasonSchema.ts";
import { getSeason, listAllSeasons } from "../services/seasonService.ts";

export const seasonRoute = new OpenAPIHono<{ Bindings: ApiBindings }>();

const listSeasonsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Seasons"],
  summary: "List all seasons",
  responses: {
    200: {
      description: "The full season catalog",
      content: { "application/json": { schema: seasonResponseSchema.array() } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

seasonRoute.openapi(listSeasonsRoute, async (c) => {
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await listAllSeasons({ listSeasons: () => listSeasons(db) });
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.season.list.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  return c.json(result.value, 200);
});

const getSeasonRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Seasons"],
  summary: "Get a season by id",
  request: { params: idParamSchema("season", "sea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The season",
      content: { "application/json": { schema: seasonResponseSchema } },
    },
    404: {
      description: "Season not found",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

seasonRoute.openapi(getSeasonRoute, async (c) => {
  const { id } = c.req.valid("param");
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await getSeason({ getSeasonById: (seasonId) => getSeasonById(db, seasonId) }, id);
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.season.get.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  if (result.value === null) {
    return c.json({ error: "Season not found" }, 404);
  }
  return c.json(result.value, 200);
});
