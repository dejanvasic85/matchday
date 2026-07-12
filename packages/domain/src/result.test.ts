import { err, isErr, isOk, mapResult, ok, unwrapOr } from "./result.ts";

describe("Result", () => {
  it("ok wraps a success value", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(isOk(result)).toBe(true);
  });

  it("err wraps a failure", () => {
    const result = err({ message: "boom" });

    expect(result).toEqual({ ok: false, error: { message: "boom" } });
    expect(isErr(result)).toBe(true);
  });

  it("mapResult transforms a success value", () => {
    const result = mapResult(ok(2), (n) => n * 3);

    expect(result).toEqual({ ok: true, value: 6 });
  });

  it("mapResult passes a failure through unchanged", () => {
    const result = mapResult(err({ message: "boom" }), (n: number) => n * 3);

    expect(result).toEqual({ ok: false, error: { message: "boom" } });
  });

  it("unwrapOr returns the fallback on failure", () => {
    expect(unwrapOr(err({ message: "boom" }), 7)).toBe(7);
  });
});
