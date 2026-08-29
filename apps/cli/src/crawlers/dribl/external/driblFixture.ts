// Raw Dribl `api/fixtures` response shape. Validated at the crawl boundary before mapping to
// domain (../mappers). Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

const driblFixtureAttributesSchema = z.object({
  // Dribl returns null for unstructured/placeholder fixtures (e.g. undecided finals rounds) —
  // nullable since the mapper doesn't consume this field anyway.
  name: z.string().nullable(),
  date: z.string(),
  round: z.string(),
  full_round: z.string(),
  ground_name: z.string().nullable(),
  // Dribl sends these as a number or a numeric string depending on the fixture; coerce either
  // to a number rather than reject the string form.
  ground_latitude: z.coerce.number().nullable(),
  ground_longitude: z.coerce.number().nullable(),
  field_name: z.string().nullable(),
  home_team_name: z.string().nullable(),
  home_team_hash_id: z.string().nullable(),
  home_logo: z.url().nullable(),
  away_team_name: z.string().nullable(),
  away_team_hash_id: z.string().nullable(),
  away_logo: z.url().nullable(),
  competition_name: z.string(),
  league_name: z.string(),
  status: z.string(),
  // Dribl sends this as a boolean or 0/1 depending on endpoint; narrow to those literals so an
  // unexpected value fails validation loudly instead of silently coercing truthy.
  bye_flag: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((value) => Boolean(value)),
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
});

const driblFixtureSchema = z.object({
  type: z.union([z.literal("fixtures"), z.literal("results")]),
  hash_id: z.string(),
  attributes: driblFixtureAttributesSchema,
});

export const driblFixturesApiResponseSchema = z.object({
  data: z.array(driblFixtureSchema),
  // Cursor pagination, 30 fixtures a page. Optional: a caller that already read every page has
  // no cursor left, and re-parsing a staged page must not depend on it.
  meta: z.object({ next_cursor: z.string().nullable() }).optional(),
});

export type DriblFixtureAttributes = z.infer<typeof driblFixtureAttributesSchema>;
export type DriblFixture = z.infer<typeof driblFixtureSchema>;
export type DriblFixturesApiResponse = z.infer<typeof driblFixturesApiResponseSchema>;
