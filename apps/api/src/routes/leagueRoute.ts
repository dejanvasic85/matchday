import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ApiBindings } from "#config.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import { jsonResult } from "#resultResponse.ts";
import { errorResponsesValue } from "#schemas/errorResponses.ts";
import { fixtureResponseSchema } from "#schemas/fixtureSchema.ts";
import { idParamSchema } from "#schemas/idParamSchema.ts";
import { leagueOverviewResponseSchema } from "#schemas/leagueOverviewSchema.ts";
import { leagueResponseSchema } from "#schemas/leagueSchema.ts";
import { pagedSchema, pagingQuerySchema } from "#schemas/pagedSchema.ts";
import { tableEntryResponseSchema } from "#schemas/tableEntrySchema.ts";
import { teamResponseSchema } from "#schemas/teamSchema.ts";
import { createFixtureServiceDeps, listLeagueFixtures } from "#services/fixtureService.ts";
import {
  createLeagueOverviewServiceDeps,
  getLeagueOverview,
} from "#services/leagueOverviewService.ts";
import { createLeagueServiceDeps, getLeague, listAllLeagues } from "#services/leagueService.ts";
import { createTableEntryServiceDeps, listLeagueTable } from "#services/tableEntryService.ts";
import { createTeamServiceDeps, listLeagueTeams } from "#services/teamService.ts";

export const leagueRoute = new OpenAPIHono<{
  Bindings: ApiBindings;
  Variables: DbVariables;
}>();

const listLeaguesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Leagues"],
  summary: "List leagues, optionally filtered by competition, season, and/or club",
  request: {
    query: pagingQuerySchema.extend({
      competitionId: z
        .string()
        .regex(/^cmp_/)
        .optional()
        .openapi({
          param: { name: "competitionId", in: "query" },
          example: "cmp_V1StGXR8Z5",
        }),
      seasonId: z
        .string()
        .regex(/^sea_/)
        .optional()
        .openapi({
          param: { name: "seasonId", in: "query" },
          example: "sea_V1StGXR8Z5",
        }),
      clubId: z
        .string()
        .regex(/^clb_/)
        .optional()
        .openapi({
          param: { name: "clubId", in: "query" },
          example: "clb_V1StGXR8Z5",
          description: "Leagues this club's teams play in, derived from league membership.",
        }),
    }),
  },
  responses: {
    200: {
      description: "A page of leagues; follow `nextCursor` until it is null",
      content: {
        "application/json": {
          schema: pagedSchema(leagueResponseSchema, "LeaguePage"),
        },
      },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeaguesRoute, async (c) => {
  const { limit, cursor, ...filter } = c.req.valid("query");
  const result = await listAllLeagues(createLeagueServiceDeps(c.get("db")), filter, {
    limit,
    cursor,
  });
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

const getLeagueOverviewRoute = createRoute({
  method: "get",
  path: "/{id}/overview",
  tags: ["Leagues"],
  summary: "Get a league with its fixtures, table and teams in one response",
  description:
    "Everything one league page renders, in a single round-trip. All three collections are " +
    "always present (empty arrays when the league has none) — use /{id}/fixtures, /{id}/table " +
    "or /{id}/teams to fetch just one.",
  request: { params: idParamSchema("league", "lea_V1StGXR8Z5") },
  responses: {
    200: {
      description: "The league, its fixtures, its table and its teams",
      content: { "application/json": { schema: leagueOverviewResponseSchema } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(getLeagueOverviewRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await getLeagueOverview(createLeagueOverviewServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.overview.failed");
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
      content: {
        "application/json": { schema: fixtureResponseSchema.array() },
      },
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
      content: {
        "application/json": { schema: tableEntryResponseSchema.array() },
      },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeagueTableRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await listLeagueTable(createTableEntryServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.table.failed");
});

const listLeagueTeamsRoute = createRoute({
  method: "get",
  path: "/{id}/teams",
  tags: ["Leagues"],
  summary: "List a league's teams",
  request: { params: idParamSchema("league", "lea_V1StGXR8Z5") },
  responses: {
    200: {
      description:
        "The league's teams, via league_team membership — includes teams in table-less " +
        "leagues (e.g. MiniRoos) that never appear in the league's table",
      content: { "application/json": { schema: teamResponseSchema.array() } },
    },
    ...errorResponsesValue,
  },
});

leagueRoute.openapi(listLeagueTeamsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await listLeagueTeams(createTeamServiceDeps(c.get("db")), id);
  return jsonResult(c, result, "api.league.teams.failed");
});
