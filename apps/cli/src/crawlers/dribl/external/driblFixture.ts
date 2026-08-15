// Raw Dribl `api/fixtures` response shape. Validated at the crawl boundary before mapping to
// domain (../mappers). Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblFixtureAttributesSchema = z.object({
  // Dribl returns null for unstructured/placeholder fixtures (e.g. finals rounds whose teams
  // aren't decided yet, "Second in League 1" vs "Third in League 1") — nullable rather than
  // required since the mapper doesn't consume this field anyway.
  name: z.string().nullable(),
  date: z.string(),
  round: z.string(),
  full_round: z.string(),
  ground_name: z.string().nullable(),
  ground_latitude: z.number().nullable(),
  ground_longitude: z.number().nullable(),
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
  // Dribl sends this as a boolean or a 0/1 number depending on endpoint; narrow to those two
  // literals (not a bare z.number()) so an unexpected numeric value fails validation loudly
  // instead of silently coercing truthy.
  bye_flag: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((value) => Boolean(value)),
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
});

export const driblFixtureSchema = z.object({
  type: z.union([z.literal("fixtures"), z.literal("results")]),
  hash_id: z.string(),
  attributes: driblFixtureAttributesSchema,
});

export const driblFixturesApiResponseSchema = z.object({
  data: z.array(driblFixtureSchema),
});

export type DriblFixtureAttributes = z.infer<typeof driblFixtureAttributesSchema>;
export type DriblFixture = z.infer<typeof driblFixtureSchema>;
export type DriblFixturesApiResponse = z.infer<typeof driblFixturesApiResponseSchema>;
