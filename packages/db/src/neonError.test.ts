import { describeCause, isTransientNeonError } from "#neonError.ts";
import { makeConnectionError, makeProxyError, makeSqlError } from "#test/fixtures/neonErrors.ts";

describe("isTransientNeonError", () => {
  it("treats a connection failure as transient — the SQL never reached Postgres", () => {
    expect(isTransientNeonError(makeConnectionError())).toBe(true);
  });

  // A retry re-runs a statement Postgres already refused, so it can only fail the same way.
  it("treats a SQL error as permanent, on the SQLSTATE rather than a missing sourceError", () => {
    expect(isTransientNeonError(makeSqlError())).toBe(false);
  });

  it("treats a 5xx from the Neon proxy as transient", () => {
    expect(isTransientNeonError(makeProxyError(502))).toBe(true);
  });

  it("treats a 429 from the Neon proxy as transient", () => {
    expect(isTransientNeonError(makeProxyError(429))).toBe(true);
  });

  it("treats a 4xx from the Neon proxy as permanent", () => {
    expect(isTransientNeonError(makeProxyError(403))).toBe(false);
  });

  it("ignores errors from anywhere but the driver", () => {
    expect(isTransientNeonError(new Error("boom"))).toBe(false);
    expect(isTransientNeonError("not an object")).toBe(false);
    expect(isTransientNeonError(null)).toBe(false);
  });
});

describe("describeCause", () => {
  // Errors JSON.stringify to `{}`, so a production failure logged as `sourceError:{}`.
  it("keeps the message and nested sourceError readable through JSON.stringify", () => {
    const logged = JSON.parse(JSON.stringify(describeCause(makeConnectionError())));

    expect(logged).toEqual({
      name: "NeonDbError",
      message: "Error connecting to database: TypeError: fetch failed",
      sourceError: { name: "TypeError", message: "fetch failed" },
    });
  });

  it("keeps the SQLSTATE and severity of a SQL error", () => {
    const logged = JSON.parse(JSON.stringify(describeCause(makeSqlError())));

    expect(logged).toMatchObject({
      message: "duplicate key value violates unique constraint",
      code: "23505",
      severity: "ERROR",
    });
  });

  it("keeps every field neon-http copies off a Postgres error, not a hand-picked few", () => {
    const error = Object.assign(new Error("violates foreign key"), {
      name: "NeonDbError",
      code: "23503",
      table: "league_team",
      constraint: "league_team_team_id_fk",
    });

    expect(describeCause(error)).toMatchObject({
      table: "league_team",
      constraint: "league_team_team_id_fk",
    });
  });

  it("terminates on a self-referencing cause chain", () => {
    const outer = new Error("outer");
    const inner = new Error("inner");
    Object.assign(outer, { cause: inner });
    Object.assign(inner, { cause: outer });

    expect(() => JSON.stringify(describeCause(outer))).not.toThrow();
  });

  it("unwraps a nested cause chain", () => {
    const logged = describeCause(new Error("outer", { cause: new Error("inner") }));

    expect(logged).toMatchObject({ message: "outer", cause: { message: "inner" } });
  });

  it("passes a non-Error through untouched", () => {
    expect(describeCause({ plain: "object" })).toEqual({ plain: "object" });
    expect(describeCause(undefined)).toBeUndefined();
  });
});
