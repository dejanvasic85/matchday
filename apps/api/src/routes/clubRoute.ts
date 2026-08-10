// Club routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param, the
// service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createConsoleLogger, type Logger } from "@matchday/domain";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { clubResponseSchema } from "@/schemas/clubSchema.ts";
import { errorSchema } from "@/schemas/errorSchema.ts";
import { idParamSchema } from "@/schemas/idParamSchema.ts";
import { createClubServiceDeps, getClub, listAllClubs } from "@/services/clubService.ts";

export const clubRoute = new OpenAPIHono<{ Bindings: ApiBindings; Variables: DbVariables }>();

const listClubsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Clubs"],
  summary: "List all clubs",
  responses: {
    200: {
      description: "The full club catalog",
      content: { "application/json": { schema: clubResponseSchema.array() } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

clubRoute.openapi(listClubsRoute, async (c) => {
  const result = await listAllClubs(createClubServiceDeps(c.get("db")));
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.club.list.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  return c.json(result.value, 200);
});

const getClubRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Clubs"],
  summary: "Get a club by id",
  request: { params: idParamSchema("club", "clb_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The club",
      content: { "application/json": { schema: clubResponseSchema } },
    },
    404: {
      description: "Club not found",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

clubRoute.openapi(getClubRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getClub(createClubServiceDeps(c.get("db")), id);
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.club.get.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  if (result.value === null) {
    return c.json({ error: "Club not found" }, 404);
  }
  return c.json(result.value, 200);
});
