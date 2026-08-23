import { unwrap, unwrapOrThrow } from "#result.ts";

function outcome<T>(init: { data?: T; error?: unknown; status?: number }) {
  const status = init.status ?? 200;
  return {
    data: init.data,
    error: init.error,
    response: new Response(null, { status }),
  };
}

describe("unwrap", () => {
  it("returns ok with the data on success", () => {
    const result = unwrap(outcome({ data: [{ id: "clb_abc123" }] }));

    expect(result).toEqual({ ok: true, value: [{ id: "clb_abc123" }] });
  });

  it("carries the API's own error message through", () => {
    const result = unwrap(outcome({ error: { error: "League not found" }, status: 404 }));

    expect(result).toEqual({
      ok: false,
      error: { status: 404, message: "League not found", cause: { error: "League not found" } },
    });
  });

  it("falls back to a status-based message when the body has none", () => {
    const result = unwrap(outcome({ error: {}, status: 500 }));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ status: 500, message: expect.stringContaining("500") }),
      }),
    );
  });

  it("fails a 2xx that carried no body", () => {
    const result = unwrap(outcome({ status: 200 }));

    expect(result).toEqual({
      ok: false,
      error: { status: 200, message: "matchday API returned no body" },
    });
  });

  it("fails a non-ok response even when openapi-fetch reported no error", () => {
    const result = unwrap(outcome({ data: undefined, status: 503 }));

    expect(result.ok).toBe(false);
  });
});

describe("unwrapOrThrow", () => {
  it("returns the data on success", () => {
    expect(unwrapOrThrow(outcome({ data: { id: "lea_abc123" } }))).toEqual({ id: "lea_abc123" });
  });

  it("throws a named error carrying the status", () => {
    expect(() => unwrapOrThrow(outcome({ error: { error: "Nope" }, status: 401 }))).toThrowError(
      expect.objectContaining({ name: "MatchdayApiError", message: "Nope", status: 401 }),
    );
  });
});
