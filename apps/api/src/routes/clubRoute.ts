// Club routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param, the
// service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { jsonResult } from "@/resultResponse.ts";
import { clubResponseSchema } from "@/schemas/clubSchema.ts";
import { errorResponsesValue } from "@/schemas/errorResponses.ts";
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
    ...errorResponsesValue,
  },
});

clubRoute.openapi(listClubsRoute, async (c) => {
  const result = await listAllClubs(createClubServiceDeps(c.get("db")));
  return jsonResult(c, result, "api.club.list.failed");
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
    ...errorResponsesValue,
  },
});

clubRoute.openapi(getClubRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getClub(createClubServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.club.get.failed");
});
