import { z } from "@hono/zod-openapi";

/** Query params every paged list route accepts. `limit` is clamped server-side, not rejected. */
export const pagingQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .optional()
    .openapi({ param: { name: "limit", in: "query" }, example: 100 }),
  cursor: z
    .string()
    .optional()
    .openapi({
      param: { name: "cursor", in: "query" },
      description: "Opaque cursor from a previous response's `nextCursor`. Invalid values 400.",
    }),
});

/** Wraps an item schema as `{ data, nextCursor }`. `nextCursor` is null on the last page, so a
 * caller loops until it's null rather than needing a total count. */
export function pagedSchema<T extends z.ZodTypeAny>(item: T, componentName: string) {
  return z.object({ data: item.array(), nextCursor: z.string().nullable() }).openapi(componentName);
}
