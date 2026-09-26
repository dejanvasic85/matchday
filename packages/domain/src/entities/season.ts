import { z } from "zod";

export const seasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Nullable: a crawl-created season may have no dates until an operator sets them.
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Season = z.infer<typeof seasonSchema>;
