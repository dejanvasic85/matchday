import { z } from "@hono/zod-openapi";

/** Lean embed of a team's owning club (#145) — not the full Club resource (skips socials,
 * grounds, email, etc.), just enough to render a team without a second request. */
const clubSummarySchema = z
  .object({
    id: z.string().openapi({ example: "clb_V1StGXR8Z5" }),
    name: z.string(),
    displayName: z.string(),
    logoUrl: z.string().nullable(),
  })
  .openapi("ClubSummary");

/** Wire shape of a team (mirrors @matchday/domain's teamSchema, dates as ISO strings). `club` is
 * null when `clubId` is null (#145). */
export const teamResponseSchema = z
  .object({
    id: z.string().openapi({ example: "tea_V1StGXR8Z5" }),
    clubId: z.string().nullable(),
    name: z.string(),
    club: clubSummarySchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Team");
