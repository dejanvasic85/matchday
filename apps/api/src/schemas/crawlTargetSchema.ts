import { z } from "@hono/zod-openapi";

export const crawlTargetResponseSchema = z
  .object({
    id: z.string(),
    competitionId: z.string().openapi({ example: "cmp_V1StGXR8Z5" }),
    leagueName: z.string(),
    currentLeagueId: z.string().nullable().openapi({
      example: "lea_V1StGXR8Z5",
      description:
        "The edition the next crawl visits, or null when none is crawlable yet: between seasons, or after a rename.",
    }),
  })
  .openapi("CrawlTarget");
