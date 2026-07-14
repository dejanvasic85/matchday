import { z } from "zod";

export const competitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Competition = z.infer<typeof competitionSchema>;
