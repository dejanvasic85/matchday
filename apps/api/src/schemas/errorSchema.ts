import { z } from "@hono/zod-openapi";

/** Shared error response shape for 404/500 (and future 403) responses across every route. */
export const errorSchema = z.object({ error: z.string() }).openapi("Error");
