import { z } from "zod";

export const teamSchema = z.object({
  id: z.string(),
  clubId: z.string(),
  name: z.string(),
  ageGroup: z.string().nullable(),
  gender: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Team = z.infer<typeof teamSchema>;
