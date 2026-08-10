// Season routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param, the
// service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { jsonResult } from "@/resultResponse.ts";
import { errorResponsesValue } from "@/schemas/errorSchema.ts";
import { idParamSchema } from "@/schemas/idParamSchema.ts";
import { seasonResponseSchema } from "@/schemas/seasonSchema.ts";
import { createSeasonServiceDeps, getSeason, listAllSeasons } from "@/services/seasonService.ts";

export const seasonRoute = new OpenAPIHono<{ Bindings: ApiBindings; Variables: DbVariables }>();

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
    ...errorResponsesValue,
  },
});

seasonRoute.openapi(listSeasonsRoute, async (c) => {
  const result = await listAllSeasons(createSeasonServiceDeps(c.get("db")));
  return jsonResult(c, result, "api.season.list.failed");
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
    ...errorResponsesValue,
  },
});

seasonRoute.openapi(getSeasonRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getSeason(createSeasonServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.season.get.failed");
});
