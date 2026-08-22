// Raw Dribl `api/tenants` and `api/list/*` response shapes, used to resolve human-readable names
// to opaque hashed IDs. Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblTenantResponseSchema = z.object({
  data: z.object({ id: z.string() }),
});

// List endpoints return `id`/`name` as top-level fields, unlike fixtures/ladders' JSON:API-style
// `attributes.name`; normalized here so downstream matching has one consistent shape.
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
