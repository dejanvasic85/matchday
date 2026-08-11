import { z } from "@hono/zod-openapi";

/** Shared error response shape for every non-2xx response across every route. */
const errorSchema = z.object({ error: z.string() }).openapi("Error");

const errorContentValue = { "application/json": { schema: errorSchema } };

/**
 * The error responses every route declares, spread into each `createRoute` call.
 *
 * `jsonResult` maps any `ErrorKind` to its status, so a handler's inferred return type includes
 * every one of these — and `openapi()` type-checks that against the route's `responses` keys.
 * Declaring the full set in one place is what lets a single response helper serve every route;
 * the cost is that an endpoint's spec lists statuses it may never actually emit.
 *
 * Deliberately not `as const`, despite the repo's `Value` convention: it widens what the spread
 * contributes to `createRoute`, collapsing each route's inferred response union to
 * `TypedResponse<any, 200>` and breaking every handler's type-check.
 */
export const errorResponsesValue = {
  400: { description: "Bad request", content: errorContentValue },
  401: { description: "Unauthorized", content: errorContentValue },
  403: { description: "Forbidden", content: errorContentValue },
  404: { description: "Not found", content: errorContentValue },
  409: { description: "Conflict", content: errorContentValue },
  500: { description: "Internal server error", content: errorContentValue },
};
