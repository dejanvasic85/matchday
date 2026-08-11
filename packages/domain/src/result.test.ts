import {
  badRequest,
  conflict,
  err,
  errorKindValue,
  forbidden,
  isErr,
  isOk,
  mapResult,
  notFound,
  ok,
  requireFound,
  serverError,
  unauthorized,
  unwrapOr,
} from "#result.ts";

describe("Result", () => {
  it("ok wraps a success value", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(isOk(result)).toBe(true);
  });

  it("err wraps a failure", () => {
    const result = err({ kind: errorKindValue.serverError, message: "boom" });

    expect(result).toEqual({
      ok: false,
      error: { kind: "ServerError", message: "boom" },
    });
    expect(isErr(result)).toBe(true);
  });

  it("mapResult transforms a success value", () => {
    const result = mapResult(ok(2), (n) => n * 3);

    expect(result).toEqual({ ok: true, value: 6 });
  });

  it("mapResult passes a failure through unchanged", () => {
    const failure = serverError("boom");

    const result = mapResult(failure, (n: number) => n * 3);

    expect(result).toEqual(failure);
  });

  it("unwrapOr returns the fallback on failure", () => {
    expect(unwrapOr(serverError("boom"), 7)).toBe(7);
  });
});

describe("error kind constructors", () => {
  it("serverError carries its cause when one is given", () => {
    const cause = new Error("underlying");

    const result = serverError("boom", cause);

    expect(result).toEqual({
      ok: false,
      error: { kind: "ServerError", message: "boom", cause },
    });
  });

  it("serverError omits the cause key entirely when none is given", () => {
    const result = serverError("boom");

    expect(result).toEqual({ ok: false, error: { kind: "ServerError", message: "boom" } });
    expect(isErr(result) && "cause" in result.error).toBe(false);
  });

  it.each([
    { construct: notFound, kind: errorKindValue.notFound },
    { construct: badRequest, kind: errorKindValue.badRequest },
    { construct: unauthorized, kind: errorKindValue.unauthorized },
    { construct: forbidden, kind: errorKindValue.forbidden },
    { construct: conflict, kind: errorKindValue.conflict },
  ])("$kind tags its failure with the matching kind", ({ construct, kind }) => {
    const result = construct("nope");

    expect(result).toEqual({ ok: false, error: { kind, message: "nope" } });
  });
});

describe("requireFound", () => {
  it("maps a present row through fn", () => {
    const result = requireFound(ok({ name: "Sharks" }), (club) => club.name, "Club not found");

    expect(result).toEqual(ok("Sharks"));
  });

  it("turns a null row into a NotFound carrying the given message", () => {
    const result = requireFound(ok(null), (club: { name: string }) => club.name, "Club not found");

    expect(result).toEqual(notFound("Club not found"));
  });

  // A lookup that failed is not the same as a lookup that found nothing — the original failure
  // (and its kind) has to survive rather than being flattened into a 404.
  it("passes a data-access failure through unchanged", () => {
    const failure = serverError("connection refused");

    const result = requireFound(failure, (club: { name: string }) => club.name, "Club not found");

    expect(result).toEqual(failure);
  });

  it("does not call fn when the row is absent", () => {
    const fn = vi.fn();

    requireFound(ok(null), fn, "Club not found");

    expect(fn).not.toHaveBeenCalled();
  });
});
