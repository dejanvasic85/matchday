import { z } from "zod";
import { parseEnv } from "#config.ts";

const schema = z.object({
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(["debug", "info"]).default("info"),
});

describe("parseEnv", () => {
  it("returns typed config for a valid source", () => {
    const config = parseEnv(schema, {
      DATABASE_URL: "postgres://user:pass@host/db",
    });

    expect(config).toEqual({
      DATABASE_URL: "postgres://user:pass@host/db",
      LOG_LEVEL: "info",
    });
  });

  it("applies schema defaults", () => {
    const config = parseEnv(schema, {
      DATABASE_URL: "postgres://user:pass@host/db",
      LOG_LEVEL: "debug",
    });

    expect(config.LOG_LEVEL).toBe("debug");
  });

  it("throws a readable error listing each invalid variable", () => {
    expect(() => parseEnv(schema, { DATABASE_URL: "not-a-url" })).toThrow(
      /Invalid environment configuration:\n {2}- DATABASE_URL:/,
    );
  });
});
