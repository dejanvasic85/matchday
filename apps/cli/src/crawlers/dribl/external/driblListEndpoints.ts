// Raw Dribl `api/tenants` and `api/list/*` response shapes, used to resolve human-readable
// names (league/competition/season) to the opaque hashed IDs the fixtures/ladders endpoints
// require. Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblTenantResponseSchema = z.object({
  data: z.object({ id: z.string() }),
});

// List endpoints (list/seasons, list/competitions, list/leagues) return items with `id`/`name`
// as top-level fields, unlike the JSON:API-style `attributes.name` used by fixtures/ladders.
// Normalized to `{ id, attributes: { name } }` here so downstream matching (resolveLeagueIds)
// has one consistent shape across all raw Dribl endpoints.
const rawDriblListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const driblListItemSchema = rawDriblListItemSchema.transform(({ id, name }) => ({
  id,
  attributes: { name },
}));

export const driblListResponseSchema = z.object({
  data: z.array(driblListItemSchema),
});

export type DriblTenantResponse = z.infer<typeof driblTenantResponseSchema>;
export type DriblListItem = z.infer<typeof driblListItemSchema>;
export type DriblListResponse = z.infer<typeof driblListResponseSchema>;
