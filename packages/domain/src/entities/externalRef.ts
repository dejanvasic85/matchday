import { z } from "zod";
import { externalRefEntityTypeValue, sourceValue } from "./constants.ts";

export const externalRefSchema = z.object({
  id: z.string(),
  entityType: z.enum(externalRefEntityTypeValue),
  internalId: z.string(),
  source: z.enum(sourceValue),
  sourceId: z.string(),
  sourceUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ExternalRef = z.infer<typeof externalRefSchema>;
