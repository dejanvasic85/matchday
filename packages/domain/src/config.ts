import type { z } from "zod";

/**
 * Parse a raw environment record against a Zod schema, throwing a single readable
 * error listing every invalid/missing variable. Each app defines its own schema and
 * calls this once at startup; env vars are documented in that app's `.env.example`.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
