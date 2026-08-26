import { badRequest, ok } from "@matchday/domain";
import { decodeCursor, encodeCursor, pagingLimitValue, resolveLimit, toPage } from "#paging.ts";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips an id", () => {
    expect(decodeCursor(encodeCursor("clb_V1StGXR8Z5"))).toEqual(ok("clb_V1StGXR8Z5"));
  });

  it("does not leak the id in plain text", () => {
    expect(encodeCursor("clb_V1StGXR8Z5")).not.toContain("clb_");
  });

  it("rejects a cursor that isn't valid base64url", () => {
    expect(decodeCursor("!!!not-a-cursor!!!")).toEqual(
      badRequest("Invalid cursor: !!!not-a-cursor!!!"),
    );
  });

  it("rejects an empty cursor", () => {
    expect(decodeCursor("")).toEqual(badRequest("Invalid cursor: "));
  });
});

describe("resolveLimit", () => {
  it("defaults when no limit is given", () => {
    expect(resolveLimit()).toBe(pagingLimitValue.default);
  });

  it("clamps above the max rather than failing the request", () => {
    expect(resolveLimit(10_000)).toBe(pagingLimitValue.max);
  });

  it("clamps a zero or negative limit up to 1", () => {
    expect(resolveLimit(0)).toBe(1);
    expect(resolveLimit(-5)).toBe(1);
  });

  it("truncates a fractional limit", () => {
    expect(resolveLimit(10.9)).toBe(10);
  });
});

describe("toPage", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("reports no next page when the extra row is absent", () => {
    expect(toPage(rows, 5)).toEqual({ rows, nextCursor: null });
  });

  it("drops the probe row and points the cursor at the last kept row", () => {
    const page = toPage(rows, 2);

    expect(page.rows).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextCursor).toBe(encodeCursor("b"));
  });

  it("reports no next page when the count exactly fills the limit", () => {
    expect(toPage(rows, 3)).toEqual({ rows, nextCursor: null });
  });

  it("handles an empty result", () => {
    expect(toPage([], 10)).toEqual({ rows: [], nextCursor: null });
  });
});
