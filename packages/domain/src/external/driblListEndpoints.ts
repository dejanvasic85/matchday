// Raw Dribl `api/tenants` and `api/list/*` response shapes, used to resolve human-readable
// names (league/competition/season) to the opaque hashed IDs the fixtures/ladders endpoints
// require. Field names mirror the Dribl API verbatim (snake_case).

import { z } from "zod";

export const driblTenantResponseSchema = z.object({
  data: z.object({ id: z.string() }),
});

const driblListItemSchema = z.object({
  id: z.string(),
  attributes: z.object({ name: z.string() }),
});

export const driblListResponseSchema = z.object({
  data: z.array(driblListItemSchema),
});

export type DriblTenantResponse = z.infer<typeof driblTenantResponseSchema>;
export type DriblListItem = z.infer<typeof driblListItemSchema>;
export type DriblListResponse = z.infer<typeof driblListResponseSchema>;
