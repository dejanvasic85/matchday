import { z } from "@hono/zod-openapi";
import { fixtureStatusValue } from "@matchday/domain";

/** Wire shape of a fixture (mirrors @matchday/domain's fixtureSchema, dates as ISO strings). */
export const fixtureResponseSchema = z
  .object({
    id: z.string().openapi({ example: "mtc_V1StGXR8Z5" }),
    leagueId: z.string(),
    competitionId: z.string(),
    seasonId: z.string(),
    round: z.number().int().nullable(),
    homeTeamId: z.string().nullable(),
    awayTeamId: z.string().nullable(),
    venue: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    kickoffAt: z.iso.datetime().nullable(),
    status: z.enum(fixtureStatusValue),
    homeScore: z.number().int().nullable(),
    awayScore: z.number().int().nullable(),
    isBye: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Fixture");
