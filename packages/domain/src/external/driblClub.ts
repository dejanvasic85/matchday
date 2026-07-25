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

// `list/clubs` already carries `email_address`/`color`/`accent`/`grounds` (confirmed live), just
// nulled out — `clubs/{id}` is the same shape plus `store`. Kept as one base schema so both
// endpoints validate against the fields they actually send.
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

// `store` is a relative path (e.g. `/club/9294`), not a full URL — only ever populated on
// `clubs/{id}`, never on `list/clubs`.
export const driblClubDetailAttributesSchema = driblClubAttributesSchema.extend({
  store: z.string().nullable(),
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
