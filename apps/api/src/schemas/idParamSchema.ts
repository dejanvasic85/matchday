import { z } from "@hono/zod-openapi";
import { idPrefixValue, type EntityType } from "@matchday/domain";

/** Path-param schema for a single `:id`, validated against the entity's id prefix. */
export function idParamSchema(entityType: EntityType, example: string) {
  const prefix = idPrefixValue[entityType];
  return z.object({
    id: z
      .string()
      .regex(new RegExp(`^${prefix}_`))
      .openapi({ param: { name: "id", in: "path" }, example }),
  });
}
