import { z } from "@hono/zod-openapi";
import { idPrefixValue, isIdOfType, type EntityId, type EntityType } from "@matchday/domain";

/** Path-param schema for a single `:id`, validated against the entity's id prefix. The parsed id
 * is typed as that entity's id, so a route can pass it to a service that takes one. */
export function idParamSchema<T extends EntityType>(entityType: T, example: string) {
  const prefix = idPrefixValue[entityType];
  return z.object({
    id: z
      .string()
      .regex(new RegExp(`^${prefix}_`))
      .refine((value): value is EntityId<T> => isIdOfType(value, entityType))
      .openapi({ param: { name: "id", in: "path" }, example }),
  });
}
