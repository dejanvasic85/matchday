import { describeCause } from "#errorCause.ts";

/** Built from a real `Error` so `message` stays non-enumerable — the whole reason these logged
 * as `{}`. `name` plus whichever fields the thrower attaches. */
function makeError(name: string, message: string, fields: Record<string, unknown> = {}): Error {
  const error = new Error(message);
  error.name = name;
  return Object.assign(error, fields);
}

describe("describeCause", () => {
  it("keeps the message and a nested sourceError readable through JSON.stringify", () => {
    const cause = makeError(
      "NeonDbError",
      "Error connecting to database: TypeError: fetch failed",
      {
        sourceError: new TypeError("fetch failed"),
      },
    );

    const logged = JSON.parse(JSON.stringify(describeCause(cause)));

    expect(logged).toEqual({
      name: "NeonDbError",
      message: "Error connecting to database: TypeError: fetch failed",
      sourceError: { name: "TypeError", message: "fetch failed" },
    });
  });

  it("keeps every field the thrower attached, not a hand-picked few", () => {
    const cause = makeError("NeonDbError", "violates foreign key", {
      code: "23503",
      table: "league_team",
      constraint: "league_team_team_id_fk",
    });

    expect(describeCause(cause)).toMatchObject({
      code: "23503",
      table: "league_team",
      constraint: "league_team_team_id_fk",
    });
  });

  it("keeps a playwright error's own fields alongside its message", () => {
    const cause = makeError("Error", "page.evaluate: Target page closed", { log: [] });

    const logged = JSON.parse(JSON.stringify(describeCause(cause)));

    expect(logged).toEqual({
      name: "Error",
      message: "page.evaluate: Target page closed",
      log: [],
    });
  });

  it("unwraps a nested cause chain", () => {
    const logged = describeCause(new Error("outer", { cause: new Error("inner") }));

    expect(logged).toMatchObject({ message: "outer", cause: { message: "inner" } });
  });

  it("terminates on a self-referencing cause chain", () => {
    const outer = new Error("outer");
    const inner = new Error("inner");
    Object.assign(outer, { cause: inner });
    Object.assign(inner, { cause: outer });

    expect(() => JSON.stringify(describeCause(outer))).not.toThrow();
  });

  it("passes a non-Error through untouched", () => {
    expect(describeCause({ plain: "object" })).toEqual({ plain: "object" });
    expect(describeCause(undefined)).toBeUndefined();
  });
});
