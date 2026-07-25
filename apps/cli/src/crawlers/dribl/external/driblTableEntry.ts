// Raw Dribl `api/ladders` response shape. Validated at the crawl boundary before mapping to
// domain (../mappers). Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblTableEntryAttributesSchema = z.object({
  team_hash_id: z.string(),
  team_name: z.string(),
  club_code: z.string(),
  club_name: z.string(),
  club_logo: z.string().nullable(),
  season_name: z.string(),
  league_name: z.string(),
  position: z.number().int(),
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  goals_for: z.number().int(),
  goals_against: z.number().int(),
  goal_difference: z.number().int(),
  points: z.number().int(),
});

export const driblTableEntrySchema = z.object({
  type: z.literal("ladder-entry"),
  id: z.string(),
  attributes: driblTableEntryAttributesSchema,
});

export const driblTableApiResponseSchema = z.object({
  data: z.array(driblTableEntrySchema),
});

export type DriblTableEntryAttributes = z.infer<typeof driblTableEntryAttributesSchema>;
export type DriblTableEntry = z.infer<typeof driblTableEntrySchema>;
export type DriblTableApiResponse = z.infer<typeof driblTableApiResponseSchema>;
