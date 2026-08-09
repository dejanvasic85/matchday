import { z } from "@hono/zod-openapi";

/** Wire shape of a club (mirrors @matchday/domain's clubSchema, dates as ISO strings). */
export const clubResponseSchema = z
  .object({
    id: z.string().openapi({ example: "clb_V1StGXR8Z5" }),
    name: z.string(),
    displayName: z.string(),
    logoUrl: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
    address: z.string().nullable(),
    socials: z.record(z.string(), z.string()).nullable(),
    grounds: z.object({ name: z.string(), address: z.string().nullable() }).nullable(),
    color: z.string().nullable(),
    accent: z.string().nullable(),
    store: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Club");
