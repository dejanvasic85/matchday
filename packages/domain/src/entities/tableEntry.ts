import { z } from "zod";

export const tableEntrySchema = z.object({
  id: z.string(),
  leagueId: z.string(),
  competitionId: z.string(),
  seasonId: z.string(),
  teamId: z.string(),
  position: z.number().int(),
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  goalDifference: z.number().int(),
  points: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TableEntry = z.infer<typeof tableEntrySchema>;
