// Club routes: thin transport glue (AGENTS.md) — OpenAPI validates the path param, the
// service maps data-access results to the wire shape, this just picks the HTTP status.

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { followClubById, unfollowClubById } from "@matchday/services";
import type { ApiBindings } from "#config.ts";
import type { ApiTokenAuthVariables } from "#middleware/apiTokenAuth.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import { jsonResult, noContentResult } from "#resultResponse.ts";
import { followClubBodySchema, followClubResponseSchema } from "#schemas/clubFollowSchema.ts";
import { clubResponseSchema } from "#schemas/clubSchema.ts";
import { errorResponsesValue } from "#schemas/errorResponses.ts";
import { idParamSchema } from "#schemas/idParamSchema.ts";
import { pagedSchema, pagingQuerySchema } from "#schemas/pagedSchema.ts";
import { createClientClubServiceDeps } from "#services/clientClubService.ts";
import { createClubServiceDeps, getClub, listAllClubs } from "#services/clubService.ts";

export const clubRoute = new OpenAPIHono<{
  Bindings: ApiBindings;
  Variables: DbVariables & ApiTokenAuthVariables;
}>();

const listClubsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Clubs"],
  summary: "List clubs, optionally filtered by name",
  request: {
    query: pagingQuerySchema.extend({
      name: z
        .string()
        .trim()
        .min(1)
        .optional()
        .openapi({
          param: { name: "name", in: "query" },
          example: "Williamstown",
          description: "Clubs whose name contains this text, ignoring case.",
        }),
    }),
  },
  responses: {
    200: {
      description: "A page of clubs; follow `nextCursor` until it is null",
      content: { "application/json": { schema: pagedSchema(clubResponseSchema, "ClubPage") } },
    },
    ...errorResponsesValue,
  },
});

clubRoute.openapi(listClubsRoute, async (c) => {
  const { limit, cursor, ...filter } = c.req.valid("query");
  const result = await listAllClubs(createClubServiceDeps(c.get("db")), filter, {
    limit,
    cursor,
  });
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

const followClubRoute = createRoute({
  method: "post",
  path: "/{id}/follow",
  tags: ["Clubs"],
  summary: "Follow a club and set the webhook that hears about its changes",
  description:
    "Follows the club for the calling client. Each call issues a new `webhookSecret`, and only the " +
    "latest response holds the live one, so keep it. Following never adds a crawl target.",
  request: {
    params: idParamSchema("club", "clb_V1StGXR8Z5"),
    body: { required: true, content: { "application/json": { schema: followClubBodySchema } } },
  },
  responses: {
    200: {
      description: "The follow, with its webhook secret",
      content: { "application/json": { schema: followClubResponseSchema } },
    },
    ...errorResponsesValue,
  },
});

clubRoute.openapi(followClubRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { webhookUrl } = c.req.valid("json");
  const result = await followClubById(createClientClubServiceDeps(c.get("db")), {
    clientId: c.get("clientId"),
    clubId: id,
    webhookUrl,
  });
  c.header("Cache-Control", "no-store");
  return jsonResult(c, result, "api.club.follow.failed");
});

const unfollowClubRoute = createRoute({
  method: "delete",
  path: "/{id}/follow",
  tags: ["Clubs"],
  summary: "Stop following a club",
  description: "Removes the calling client's follow and its webhook.",
  request: { params: idParamSchema("club", "clb_V1StGXR8Z5") },
  responses: {
    204: { description: "No longer following" },
    ...errorResponsesValue,
  },
});

clubRoute.openapi(unfollowClubRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await unfollowClubById(createClientClubServiceDeps(c.get("db")), {
    clientId: c.get("clientId"),
    clubId: id,
  });
  return noContentResult(c, result, "api.club.unfollow.failed");
});
