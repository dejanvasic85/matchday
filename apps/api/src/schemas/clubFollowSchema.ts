import { z } from "@hono/zod-openapi";

export const followClubBodySchema = z
  .object({
    webhookUrl: z.string().min(1).openapi({
      example: "https://hooks.example.com/matchday",
      description:
        "Where we POST a signed notification when this club's data changes. Must be https with a public hostname.",
    }),
  })
  .openapi("FollowClubRequest");

export const followClubResponseSchema = z
  .object({
    clubId: z.string().openapi({ example: "clb_V1StGXR8Z5" }),
    webhookUrl: z.string(),
    webhookSecret: z.string().openapi({
      description:
        "Signs each notification. Shown only in this response; following again issues a new one.",
    }),
  })
  .openapi("ClubFollow");
