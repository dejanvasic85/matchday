// Team routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates params, the service
// maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createConsoleLogger, type Logger } from "@matchday/domain";
import { createDbClient, getTeamById, listTeams } from "@matchday/db";
import { getApiConfig, type ApiBindings } from "../config.ts";
import { errorSchema } from "../schemas/errorSchema.ts";
import { idParamSchema } from "../schemas/idParamSchema.ts";
import { teamResponseSchema } from "../schemas/teamSchema.ts";
import { getTeam, listAllTeams } from "../services/teamService.ts";

export const teamRoute = new OpenAPIHono<{ Bindings: ApiBindings }>();

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
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

teamRoute.openapi(listTeamsRoute, async (c) => {
  const { clubId } = c.req.valid("query");
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await listAllTeams({ listTeams: (filter) => listTeams(db, filter) }, clubId);
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.team.list.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  return c.json(result.value, 200);
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
    404: {
      description: "Team not found",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

teamRoute.openapi(getTeamRoute, async (c) => {
  const { id } = c.req.valid("param");
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await getTeam({ getTeamById: (teamId) => getTeamById(db, teamId) }, id);
  if (!result.ok) {
    const logger: Logger = createConsoleLogger();
    logger.error("api.team.get.failed", result.error.message, { cause: result.error.cause });
    return c.json({ error: "Internal server error" }, 500);
  }
  if (result.value === null) {
    return c.json({ error: "Team not found" }, 404);
  }
  return c.json(result.value, 200);
});
