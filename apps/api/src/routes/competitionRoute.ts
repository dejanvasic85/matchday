// Competition routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates the path param,
// the service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { jsonResult } from "@/resultResponse.ts";
import { competitionResponseSchema } from "@/schemas/competitionSchema.ts";
import { errorResponsesValue } from "@/schemas/errorResponses.ts";
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
    ...errorResponsesValue,
  },
});

competitionRoute.openapi(listCompetitionsRoute, async (c) => {
  const result = await listAllCompetitions(createCompetitionServiceDeps(c.get("db")));
  return jsonResult(c, result, "api.competition.list.failed");
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
    ...errorResponsesValue,
  },
});

competitionRoute.openapi(getCompetitionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getCompetition(createCompetitionServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.competition.get.failed");
});
