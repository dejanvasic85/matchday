import { z } from "zod";
import { fixtureStatusValue } from "./constants.ts";

export const fixtureSchema = z.object({
  id: z.string(),
  leagueId: z.string(),
  competitionId: z.string(),
  seasonId: z.string(),
  round: z.number().int().nullable(),
  homeTeamId: z.string().nullable(),
  awayTeamId: z.string().nullable(),
  venue: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  kickoffAt: z.date().nullable(),
  status: z.enum(fixtureStatusValue),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  isBye: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Fixture = z.infer<typeof fixtureSchema>;
