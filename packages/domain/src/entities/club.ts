import { z } from "zod";

export const socialsSchema = z.record(z.string(), z.string());

export type Socials = z.infer<typeof socialsSchema>;

// Despite the plural Dribl field name, `clubs/{id}` carries at most one ground per club, not a
// list — see mapDriblClubDetail.
export const groundSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
});

export type Ground = z.infer<typeof groundSchema>;

export const clubSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  logoUrl: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  socials: socialsSchema.nullable(),
  grounds: groundSchema.nullable(),
  color: z.string().nullable(),
  accent: z.string().nullable(),
  store: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Club = z.infer<typeof clubSchema>;
