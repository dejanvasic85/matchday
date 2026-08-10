// Team routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates params, the service
// maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { jsonResult } from "@/resultResponse.ts";
import { errorResponsesValue } from "@/schemas/errorResponses.ts";
import { idParamSchema } from "@/schemas/idParamSchema.ts";
import { teamResponseSchema } from "@/schemas/teamSchema.ts";
import { createTeamServiceDeps, getTeam, listAllTeams } from "@/services/teamService.ts";

export const teamRoute = new OpenAPIHono<{ Bindings: ApiBindings; Variables: DbVariables }>();

const listTeamsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Teams"],
  summary: "List teams, optionally filtered to one club",
  request: {
    query: z.object({
      clubId: z
        .string()
        .regex(/^clb_/)
        .optional()
        .openapi({ param: { name: "clubId", in: "query" }, example: "clb_V1StGXR8Z5" }),
    }),
  },
  responses: {
    200: {
      description: "Teams matching the filter",
      content: { "application/json": { schema: teamResponseSchema.array() } },
    },
    ...errorResponsesValue,
  },
});

teamRoute.openapi(listTeamsRoute, async (c) => {
  const { clubId } = c.req.valid("query");
  const result = await listAllTeams(createTeamServiceDeps(c.get("db")), clubId);
  return jsonResult(c, result, "api.team.list.failed");
});

const getTeamRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Teams"],
  summary: "Get a team by id",
  request: { params: idParamSchema("team", "tea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The team",
      content: { "application/json": { schema: teamResponseSchema } },
    },
    ...errorResponsesValue,
  },
});

teamRoute.openapi(getTeamRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getTeam(createTeamServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.team.get.failed");
});
