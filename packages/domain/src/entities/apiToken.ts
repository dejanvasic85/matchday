import { z } from "zod";

// A client's API bearer token, hashed at rest. A client can hold several active
// tokens to rotate one in before revoking the old; `revokedAt` set means no longer valid.
export const apiTokenSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  tokenHash: z.string(),
  revokedAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ApiToken = z.infer<typeof apiTokenSchema>;
