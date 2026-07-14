import { z } from "zod";

export const socialsSchema = z.record(z.string(), z.string());

export type Socials = z.infer<typeof socialsSchema>;

export const clubSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  logoUrl: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  socials: socialsSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Club = z.infer<typeof clubSchema>;
