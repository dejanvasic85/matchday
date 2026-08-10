import { z } from "@hono/zod-openapi";

/** Wire shape of a team (mirrors @matchday/domain's teamSchema, dates as ISO strings). */
export const teamResponseSchema = z
  .object({
    id: z.string().openapi({ example: "tea_V1StGXR8Z5" }),
    clubId: z.string().nullable(),
    name: z.string(),
    ageGroup: z.string().nullable(),
    gender: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Team");
