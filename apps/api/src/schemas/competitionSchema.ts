import { z } from "@hono/zod-openapi";

/** Wire shape of a competition (mirrors @matchday/domain's competitionSchema, dates as ISO strings). */
export const competitionResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cmp_V1StGXR8Z5" }),
    name: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Competition");
