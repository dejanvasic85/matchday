import { z } from "@hono/zod-openapi";

/** Wire shape of a league (mirrors @matchday/domain's leagueSchema, dates as ISO strings). */
export const leagueResponseSchema = z
  .object({
    id: z.string().openapi({ example: "lea_V1StGXR8Z5" }),
    name: z.string(),
    competitionId: z.string(),
    seasonId: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("League");
