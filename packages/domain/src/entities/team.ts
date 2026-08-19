import { z } from "zod";

export const teamSchema = z.object({
  id: z.string(),
  clubId: z.string().nullable(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Team = z.infer<typeof teamSchema>;
