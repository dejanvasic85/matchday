import { isTransientNeonError } from "#neonError.ts";
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
