import { getDbConfig } from "./config.ts";

describe("getDbConfig", () => {
  it("returns the parsed config for a valid DATABASE_URL", () => {
    const config = getDbConfig({ DATABASE_URL: "postgres://user:pass@host/db" });

    expect(config).toEqual({ DATABASE_URL: "postgres://user:pass@host/db" });
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => getDbConfig({})).toThrow(
      /Invalid environment configuration:\n {2}- DATABASE_URL:/,
    );
  });

  it("throws a readable error when DATABASE_URL is not a url", () => {
    expect(() => getDbConfig({ DATABASE_URL: "not-a-url" })).toThrow(
      /Invalid environment configuration:\n {2}- DATABASE_URL:/,
    );
  });
});
