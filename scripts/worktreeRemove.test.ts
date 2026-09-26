import { parseRemoveArgs, removalRefusal } from "#scripts/worktreeRemove.ts";

// argv as node hands it over: the runtime, the script, then the real arguments.
function argv(...args: string[]): string[] {
  return ["node", "scripts/worktreeRemove.ts", ...args];
}

describe("parseRemoveArgs", () => {
  it("reads the branch from the first positional argument", () => {
    expect(parseRemoveArgs(argv("issue-141"))).toEqual({
      branch: "issue-141",
      force: false,
      keepDatabase: false,
      dryRun: false,
    });
  });

  it("gives no branch when none was passed, so main can print the usage", () => {
    expect(parseRemoveArgs(argv()).branch).toBeUndefined();
  });

  it("turns force on for --force", () => {
    expect(parseRemoveArgs(argv("issue-141", "--force")).force).toBe(true);
  });

  it("keeps the database for --no-db", () => {
    expect(parseRemoveArgs(argv("issue-141", "--no-db")).keepDatabase).toBe(true);
  });

  it("turns dry run on for --dry-run", () => {
    expect(parseRemoveArgs(argv("issue-141", "--dry-run")).dryRun).toBe(true);
  });

  it("does not mistake a flag for the branch", () => {
    expect(parseRemoveArgs(argv("--force", "issue-141")).branch).toBe("issue-141");
  });
});

describe("removalRefusal", () => {
  it("refuses the shared branch and main, whatever their git branch does", () => {
    expect(removalRefusal("production")).toContain("protected");
    expect(removalRefusal("main")).toContain("protected");
  });

  it("refuses a CI branch", () => {
    expect(removalRefusal("pr-89")).toContain("protected");
  });

  it("refuses an empty name with the usage line", () => {
    expect(removalRefusal("  ")).toContain("Usage:");
  });

  it("allows a feature branch", () => {
    expect(removalRefusal("issue-141")).toBeUndefined();
    expect(removalRefusal("fix/squad-numbers")).toBeUndefined();
  });
});
