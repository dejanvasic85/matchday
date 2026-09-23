import { escapeLikePattern } from "#likePattern.ts";

describe("escapeLikePattern", () => {
  it("leaves plain text alone", () => {
    expect(escapeLikePattern("Williamstown SC")).toBe("Williamstown SC");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(escapeLikePattern("100%_club")).toBe("100\\%\\_club");
  });

  it("escapes the escape character itself", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });
});
