import { ok, serverError } from "@matchday/domain";
import { retryConfigValue } from "./constants.ts";
import { runQuery } from "./runQuery.ts";

/** A neon-http connection-level failure: NeonDbError with no populated sourceError. */
function makeTransientError() {
  return { name: "NeonDbError", sourceError: {} };
}

/** A neon-http SQL error: NeonDbError carrying the database's own error. */
function makeSqlError() {
  return { name: "NeonDbError", sourceError: { code: "23505", message: "duplicate key" } };
}

describe("runQuery", () => {
  it("returns ok with the query result on success", async () => {
    const fn = vi.fn().mockResolvedValue([{ id: "row1" }]);

    const result = await runQuery(fn, "should not fail");

    expect(result).toEqual(ok([{ id: "row1" }]));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient neon-http error and succeeds on a later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeTransientError())
      .mockResolvedValueOnce([{ id: "row1" }]);

    const result = await runQuery(fn, "transient then ok");

    expect(result).toEqual(ok([{ id: "row1" }]));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts when the transient error persists", async () => {
    const cause = makeTransientError();
    const fn = vi.fn().mockRejectedValue(cause);

    const result = await runQuery(fn, "always transient");

    expect(result).toEqual(serverError("always transient", cause));
    expect(fn).toHaveBeenCalledTimes(retryConfigValue.maxAttempts);
  });

  it("does not retry a real SQL error (populated sourceError)", async () => {
    const cause = makeSqlError();
    const fn = vi.fn().mockRejectedValue(cause);

    const result = await runQuery(fn, "sql error");

    expect(result).toEqual(serverError("sql error", cause));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-neon error", async () => {
    const cause = new Error("boom");
    const fn = vi.fn().mockRejectedValue(cause);

    const result = await runQuery(fn, "generic error");

    expect(result).toEqual(serverError("generic error", cause));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
