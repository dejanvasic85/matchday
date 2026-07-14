import { z } from "zod";

export const leagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  competitionId: z.string(),
  seasonId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type League = z.infer<typeof leagueSchema>;
