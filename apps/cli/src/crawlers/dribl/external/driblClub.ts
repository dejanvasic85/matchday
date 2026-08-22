// Raw Dribl `api/list/clubs` response shape. Validated at the crawl boundary before mapping to
// domain (../mappers). Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblClubAddressSchema = z.object({
  address_line_1: z.string().nullable(),
  address_line_2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postcode: z.string().nullable(),
});

// `name` is tolerant (any platform Dribl returns, not just the ones seen so far) so an
// unfamiliar social platform doesn't fail validation and abort the crawl.
export const driblClubSocialSchema = z.object({
  name: z.string(),
  value: z.url(),
});

// Despite the plural name, Dribl carries at most one ground per club (confirmed against a live
// `clubs/{id}` response); `address` is already a formatted string, not the nested address shape.
export const driblClubGroundSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
});

// `list/clubs` already carries these fields, just nulled out; `clubs/{id}` is the same shape
// plus `store` — kept as one base schema so both endpoints validate correctly.
export const driblClubAttributesSchema = z.object({
  name: z.string(),
  image: z.url().nullable(),
  email: z.string().nullable(),
  email_address: z.string().nullable(),
  url: z.string().nullable(),
  address: driblClubAddressSchema.nullable(),
  socials: z.array(driblClubSocialSchema).nullable(),
  color: z.string().nullable(),
  accent: z.string().nullable(),
  grounds: driblClubGroundSchema.nullable(),
});

export const driblClubSchema = z.object({
  type: z.literal("clubs"),
  id: z.string(),
  attributes: driblClubAttributesSchema,
});

export const driblClubsApiResponseSchema = z.object({
  data: z.array(driblClubSchema),
});

// `store` is `null` for most clubs but missing entirely for others on `clubs/{id}` (confirmed
// live) — optional as well as nullable, not just nullable.
export const driblClubDetailAttributesSchema = driblClubAttributesSchema.extend({
  store: z.string().nullable().optional(),
});

export const driblClubDetailSchema = z.object({
  type: z.literal("clubs"),
  id: z.string(),
  attributes: driblClubDetailAttributesSchema,
});

// `clubs/{id}` returns a single object under `data`, unlike `list/clubs`'s array.
export const driblClubDetailApiResponseSchema = z.object({
  data: driblClubDetailSchema,
});

export type DriblClubGround = z.infer<typeof driblClubGroundSchema>;
export type DriblClubAttributes = z.infer<typeof driblClubAttributesSchema>;
export type DriblClub = z.infer<typeof driblClubSchema>;
export type DriblClubsApiResponse = z.infer<typeof driblClubsApiResponseSchema>;
export type DriblClubDetailAttributes = z.infer<typeof driblClubDetailAttributesSchema>;
export type DriblClubDetail = z.infer<typeof driblClubDetailSchema>;
export type DriblClubDetailApiResponse = z.infer<typeof driblClubDetailApiResponseSchema>;
