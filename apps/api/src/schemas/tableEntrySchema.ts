import { z } from "@hono/zod-openapi";

/** Wire shape of a table entry (mirrors @matchday/domain's tableEntrySchema, dates as ISO
 * strings). */
export const tableEntryResponseSchema = z
  .object({
    id: z.string().openapi({ example: "tab_V1StGXR8Z5" }),
    leagueId: z.string(),
    competitionId: z.string(),
    seasonId: z.string(),
    teamId: z.string(),
    position: z.number().int(),
    played: z.number().int(),
    won: z.number().int(),
    drawn: z.number().int(),
    lost: z.number().int(),
    goalsFor: z.number().int(),
    goalsAgainst: z.number().int(),
    goalDifference: z.number().int(),
    points: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TableEntry");
