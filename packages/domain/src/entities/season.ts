import { z } from "zod";
import { sourceValue } from "#entities/constants.ts";

export const seasonSchema = z.object({
  id: z.string(),
  /** The source this season belongs to. Season names collide across sources, so `(source, name)` is
   * the identity; the source's own season id lives in `external_ref`. */
  source: z.enum(sourceValue),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Season = z.infer<typeof seasonSchema>;
