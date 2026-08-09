import { z } from "zod";

// A client of the API (ADR 0013): the entity both subscriptions and API tokens belong to.
export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Client = z.infer<typeof clientSchema>;
