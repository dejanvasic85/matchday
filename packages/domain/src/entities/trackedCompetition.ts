import { z } from "zod";

export const trackedCompetitionSchema = z.object({
  id: z.string(),
  competitionId: z.string(),
  seasonId: z.string(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TrackedCompetition = z.infer<typeof trackedCompetitionSchema>;
