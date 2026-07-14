// Raw Dribl `api/list/clubs` response shape. Validated at the crawl boundary before mapping to
// domain (packages/domain/src/mappers). Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblClubAddressSchema = z.object({
  address_line_1: z.string().nullable(),
  address_line_2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postcode: z.string().nullable(),
});

export const driblClubSocialSchema = z.object({
  name: z.enum(["facebook", "instagram", "twitter"]),
  value: z.url(),
});

export const driblClubAttributesSchema = z.object({
  name: z.string(),
  image: z.url().nullable(),
  email: z.string().nullable(),
  url: z.string().nullable(),
  address: driblClubAddressSchema.nullable(),
  socials: z.array(driblClubSocialSchema).nullable(),
});

export const driblClubSchema = z.object({
  type: z.literal("clubs"),
  id: z.string(),
  attributes: driblClubAttributesSchema,
});

export const driblClubsApiResponseSchema = z.object({
  data: z.array(driblClubSchema),
});

export type DriblClubAttributes = z.infer<typeof driblClubAttributesSchema>;
export type DriblClub = z.infer<typeof driblClubSchema>;
export type DriblClubsApiResponse = z.infer<typeof driblClubsApiResponseSchema>;
