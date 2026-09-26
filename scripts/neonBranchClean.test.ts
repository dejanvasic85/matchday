import { canRemoveBranch, removeNamedBranch, staleBranches } from "#scripts/neonBranchClean.ts";

// These names are what the script deletes, so the tests read as the rules rather than as
// the filter: a wrong answer here drops a real database.
const prefix = "unraid/";

function live(...names: string[]): ReadonlySet<string> {
  return new Set(names);
}

describe("staleBranches", () => {
  it("reclaims a branch of this machine whose git branch has gone", () => {
    expect(staleBranches(["unraid/feat/merged"], live(), prefix)).toEqual(["unraid/feat/merged"]);
  });

  it("keeps a branch whose git branch is still checked out", () => {
    expect(staleBranches(["unraid/feat/wip"], live("unraid/feat/wip"), prefix)).toEqual([]);
  });

  // Someone else's laptop is never this machine's to tidy up.
  it("never touches another machine's branch, even with no git branch behind it", () => {
    expect(staleBranches(["laptop/feat/merged"], live(), prefix)).toEqual([]);
  });

  // production carries no machine prefix, which is what saves it.
  it("leaves the shared branch alone", () => {
    expect(staleBranches(["production", "pr-89"], live(), prefix)).toEqual([]);
  });

  it("reclaims several at once, in the order they came", () => {
    const names = ["unraid/a", "laptop/b", "unraid/c", "production"];

    expect(staleBranches(names, live("unraid/c"), prefix)).toEqual(["unraid/a"]);
  });

  it("finds nothing to do when the machine has no branches", () => {
    expect(staleBranches([], live("unraid/feat/wip"), prefix)).toEqual([]);
  });

  // A prefix match has to be a whole segment, not a machine whose name starts with this one's.
  it("does not treat a longer machine name as this machine", () => {
    expect(staleBranches(["unraid-2/feat/merged"], live(), prefix)).toEqual([]);
  });
});

describe("canRemoveBranch", () => {
  it("allows a normal branch of this machine", () => {
    expect(canRemoveBranch("unraid/issue-141", prefix)).toBe(true);
  });

  it("refuses another machine's branch", () => {
    expect(canRemoveBranch("laptop/issue-141", prefix)).toBe(false);
  });

  it("refuses a shared branch, which carries no machine prefix", () => {
    expect(canRemoveBranch("production", prefix)).toBe(false);
  });

  it("refuses a CI branch", () => {
    expect(canRemoveBranch("pr-89", prefix)).toBe(false);
  });
});

describe("removeNamedBranch", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a protected branch before it reads or deletes anything", () => {
    expect(removeNamedBranch("production", prefix, false)).toBe(false);
  });

  it("refuses another machine's branch", () => {
    expect(removeNamedBranch("laptop/feat/merged", prefix, false)).toBe(false);
  });
});
