import { ok, serverError } from "@matchday/domain";
import { checkHealth, type CheckHealthDeps } from "#services/healthService.ts";

function makeDeps(overrides: Partial<CheckHealthDeps> = {}): CheckHealthDeps {
  return {
    pingDb: vi.fn().mockResolvedValue(ok(undefined)),
    ...overrides,
  };
}

describe("checkHealth", () => {
  it("returns ok when the database ping succeeds", async () => {
    const deps = makeDeps();

    const result = await checkHealth(deps);

    expect(result).toEqual(ok({ status: "ok" }));
  });

  it("returns an error without masking the cause when the ping fails", async () => {
    const cause = new Error("timeout");
    const deps = makeDeps({
      pingDb: vi.fn().mockResolvedValue(serverError("Failed to ping database", cause)),
    });

    const result = await checkHealth(deps);

    expect(result).toEqual(serverError("Database unreachable", cause));
  });
});
