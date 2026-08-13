// League routes (0045): thin transport glue (AGENTS.md) — OpenAPI validates params, the service
// maps data-access results to the wire shape, this just picks the HTTP status. Fixtures/table are
// nested under a league, same open-catalog access as the list/get routes above (ADR 0012:
// subscriptions only pick which leagues get deep-crawled, not who can read the result).

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ApiBindings } from "#config.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import { jsonResult } from "#resultResponse.ts";
import { errorResponsesValue } from "#schemas/errorResponses.ts";
import { fixtureResponseSchema } from "#schemas/fixtureSchema.ts";
import { idParamSchema } from "#schemas/idParamSchema.ts";
import { leagueResponseSchema } from "#schemas/leagueSchema.ts";
import { tableEntryResponseSchema } from "#schemas/tableEntrySchema.ts";
import { createFixtureServiceDeps, listLeagueFixtures } from "#services/fixtureService.ts";
import { createLeagueServiceDeps, getLeague, listAllLeagues } from "#services/leagueService.ts";
import { createTableEntryServiceDeps, listLeagueTable } from "#services/tableEntryService.ts";

export const leagueRoute = new OpenAPIHono<{ Bindings: ApiBindings; Variables: DbVariables }>();

const listLeaguesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Leagues"],
  summary: "List leagues, optionally filtered by competition, season, and/or club",
  request: {
    query: z.object({
      competitionId: z
        .string()
        .regex(/^cmp_/)
        .optional()
        .openapi({ param: { name: "competitionId", in: "query" }, example: "cmp_V1StGXR8Z5" }),
      seasonId: z
        .string()
        .regex(/^sea_/)
        .optional()
        .openapi({ param: { name: "seasonId", in: "query" }, example: "sea_V1StGXR8Z5" }),
      clubId: z
        .string()
        .regex(/^clb_/)
        .optional()
        .openapi({
          param: { name: "clubId", in: "query" },
          example: "clb_V1StGXR8Z5",
          description: "Leagues this club's teams play in, derived from table entries (0012).",
        }),
    }),
  },
  responses: {
    200: {
      description: "Leagues matching the filter",
      content: { "application/json": { schema: leagueResponseSchema.array() } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeaguesRoute, async (c) => {
  const filter = c.req.valid("query");
  const result = await listAllLeagues(createLeagueServiceDeps(c.get("db")), filter);
  return jsonResult(c, result, "api.league.list.failed");
});

const getLeagueRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Leagues"],
  summary: "Get a league by id",
  request: { params: idParamSchema("league", "lea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The league",
      content: { "application/json": { schema: leagueResponseSchema } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(getLeagueRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getLeague(createLeagueServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.get.failed");
});

const listLeagueFixturesRoute = createRoute({
  method: "get",
  path: "/{id}/fixtures",
  tags: ["Leagues"],
  summary: "List a league's fixtures",
  request: { params: idParamSchema("league", "lea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The league's fixtures, round- then kickoff-ordered",
      content: { "application/json": { schema: fixtureResponseSchema.array() } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeagueFixturesRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await listLeagueFixtures(createFixtureServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.fixtures.failed");
});

const listLeagueTableRoute = createRoute({
  method: "get",
  path: "/{id}/table",
  tags: ["Leagues"],
  summary: "Get a league's table",
  request: { params: idParamSchema("league", "lea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The league's table, position-ordered",
      content: { "application/json": { schema: tableEntryResponseSchema.array() } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeagueTableRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await listLeagueTable(createTableEntryServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.table.failed");
});
