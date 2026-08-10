import { z } from "@hono/zod-openapi";

/** Wire shape of a season (mirrors @matchday/domain's seasonSchema, dates as ISO strings). */
export const seasonResponseSchema = z
  .object({
    id: z.string().openapi({ example: "sea_V1StGXR8Z5" }),
    name: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Season");
