import { z } from "zod";

export const seasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Season = z.infer<typeof seasonSchema>;
