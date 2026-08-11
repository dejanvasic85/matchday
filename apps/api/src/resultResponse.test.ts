import { badRequest, conflict, notFound, ok, serverError, unauthorized } from "@matchday/domain";
import type { Context, Env } from "hono";
import { jsonResult } from "#resultResponse.ts";

/** The helper only ever touches `c.json`, so a fake that records its arguments is enough — no
 * Hono request/response plumbing needed to assert the status mapping. */
function makeContext() {
  const json = vi.fn((body: unknown, status: number) => ({ body, status }));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a `c.json`-only stand-in is
  // all this helper consumes; building a real Hono Context here would test the framework.
  return { json } as unknown as Context<Env> & { json: typeof json };
}

describe("jsonResult", () => {
  it("returns 200 with the value on success", () => {
    const c = makeContext();

    jsonResult(c, ok([{ id: "clb_1" }]), "api.club.list.failed");

    expect(c.json).toHaveBeenCalledWith([{ id: "clb_1" }], 200);
  });

  it.each([
    { kind: "NotFound", failure: notFound("Club not found"), status: 404 },
    { kind: "BadRequest", failure: badRequest("Malformed id"), status: 400 },
    { kind: "Unauthorized", failure: unauthorized("Invalid token"), status: 401 },
    { kind: "Conflict", failure: conflict("Club already exists"), status: 409 },
  ])("maps a $kind failure to $status, returning its message", ({ failure, status }) => {
    const c = makeContext();

    jsonResult(c, failure, "api.club.get.failed");

    const [body, calledStatus] = c.json.mock.calls[0] ?? [];
    expect(calledStatus).toBe(status);
    expect(body).toEqual({ error: failure.ok ? "" : failure.error.message });
  });

  // A ServerError's message describes our internals, so it is the one kind whose text the client
  // never sees — it goes to the log instead.
  it("returns a 500 that withholds the message on a ServerError", () => {
    const c = makeContext();

    jsonResult(c, serverError("connection to Neon refused"), "api.club.list.failed");

    expect(c.json).toHaveBeenCalledWith({ error: "Internal server error" }, 500);
  });

  it("logs a ServerError's underlying message rather than returning it", () => {
    const c = makeContext();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonResult(c, serverError("connection to Neon refused"), "api.club.list.failed");

    expect(JSON.stringify(consoleError.mock.calls)).toContain("connection to Neon refused");
  });

  it("does not log a NotFound, which is an expected outcome rather than a fault", () => {
    const c = makeContext();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonResult(c, notFound("Club not found"), "api.club.get.failed");

    expect(consoleError).not.toHaveBeenCalled();
  });
});
