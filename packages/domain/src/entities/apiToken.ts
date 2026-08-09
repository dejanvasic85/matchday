import { z } from "zod";

// A client's API bearer token (ADR 0013), hashed at rest — `tokenHash` never holds the plaintext
// token. A client can hold several active tokens at once so it can rotate one in before revoking
// the old one; `revokedAt` set marks a token no longer valid for auth.
export const apiTokenSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  tokenHash: z.string(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ApiToken = z.infer<typeof apiTokenSchema>;
