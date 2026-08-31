import { ok, serverError } from "@matchday/domain";
import { retryConfigValue } from "#constants.ts";
import { runQuery } from "#runQuery.ts";
import { makeConnectionError, makeProxyError, makeSqlError } from "#test/fixtures/neonErrors.ts";

// Which errors count as transient is neonError.test.ts's job; these cover the retry loop itself.
describe("runQuery", () => {
  it("returns ok with the query result on success", async () => {
    const fn = vi.fn().mockResolvedValue([{ id: "row1" }]);

    const result = await runQuery(fn, "should not fail");

    expect(result).toEqual(ok([{ id: "row1" }]));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient error and succeeds on a later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeConnectionError())
      .mockResolvedValueOnce([{ id: "row1" }]);

    const result = await runQuery(fn, "transient then ok");

    expect(result).toEqual(ok([{ id: "row1" }]));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts when the transient error persists", async () => {
    const fn = vi.fn().mockRejectedValue(makeProxyError(503));

    const result = await runQuery(fn, "always transient");

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(retryConfigValue.maxAttempts);
  });

  it("fails immediately on a permanent error", async () => {
    const fn = vi.fn().mockRejectedValue(makeSqlError());

    const result = await runQuery(fn, "sql error");

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-neon error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await runQuery(fn, "generic error");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual(serverError("generic error", { name: "Error", message: "boom" }));
  });

  it("reports the last cause in a form that survives JSON logging", async () => {
    const fn = vi.fn().mockRejectedValue(makeConnectionError());

    const result = await runQuery(fn, "connection failed");

    expect(result.ok).toBe(false);
    const logged = JSON.parse(JSON.stringify(result.ok ? null : result.error.cause));
    expect(logged).toMatchObject({
      message: "Error connecting to database: TypeError: fetch failed",
      sourceError: { message: "fetch failed" },
    });
  });
});
