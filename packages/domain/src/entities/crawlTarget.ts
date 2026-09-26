import { z } from "zod";

/** A league the system crawls. The competition id stays the same every year, and the league name
 * repeats between seasons, so a target survives a season rollover without an edit. */
export const crawlTargetSchema = z.object({
  id: z.string(),
  competitionId: z.string(),
  leagueName: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CrawlTarget = z.infer<typeof crawlTargetSchema>;
