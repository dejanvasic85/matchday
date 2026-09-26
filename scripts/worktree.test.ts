import { parseArgs, parseDays, targetPath } from "#scripts/worktree.ts";

// argv as node hands it over: the runtime, the script, then the real arguments.
function argv(...args: string[]): string[] {
  return ["node", "scripts/worktree.ts", ...args];
}

describe("targetPath", () => {
  it("puts the worktree beside the main checkout, named after the branch", () => {
    expect(targetPath("/home/dev/code/matchday", "feat/team-lists")).toBe(
      "/home/dev/code/matchday-feat-team-lists",
    );
  });

  it("replaces a run of path-unsafe characters with one dash", () => {
    expect(targetPath("/home/dev/code/matchday", "fix/a b//c")).toBe(
      "/home/dev/code/matchday-fix-a-b-c",
    );
  });

  it("keeps the dots and dashes a directory name can hold", () => {
    expect(targetPath("/home/dev/code/matchday", "chore/v1.2-rc")).toBe(
      "/home/dev/code/matchday-chore-v1.2-rc",
    );
  });
});

describe("parseDays", () => {
  it("defaults when nobody asks", () => {
    expect(parseDays([])).toBe(7);
  });

  it("takes the number after --days", () => {
    expect(parseDays(["--days", "2"])).toBe(2);
  });

  it("falls back to the default when the value is not a number", () => {
    expect(parseDays(["--days", "soon"])).toBe(7);
    expect(parseDays(["--days"])).toBe(7);
  });
});

describe("parseArgs", () => {
  it("reads the branch from the first positional argument", () => {
    expect(parseArgs(argv("feat/thing"))).toEqual({
      branch: "feat/thing",
      database: true,
      days: 7,
    });
  });

  it("gives no branch when none was passed, so main can say how to call it", () => {
    expect(parseArgs(argv()).branch).toBeUndefined();
  });

  it("turns the database off for --no-db", () => {
    expect(parseArgs(argv("feat/thing", "--no-db")).database).toBe(false);
  });

  // The value after --days is not the branch, whichever order they come in.
  it("does not mistake the --days value for the branch", () => {
    expect(parseArgs(argv("--days", "2", "feat/thing"))).toEqual({
      branch: "feat/thing",
      database: true,
      days: 2,
    });
  });
});
