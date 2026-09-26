import {
  branchName,
  cappedExpiryDays,
  expiryTimestamp,
  isOwnBranchName,
  isProtectedBranch,
  machineId,
  neonBranchValue,
  slug,
  splitCommand,
  withRetries,
} from "#scripts/neonBranch.ts";

describe("slug", () => {
  it("lowercases and keeps the characters a Neon branch name allows", () => {
    expect(slug("Feat/Team-Lists.v2")).toBe("feat/team-lists.v2");
  });

  it("collapses a run of other characters into one dash", () => {
    expect(slug("feat: team  lists!")).toBe("feat-team-lists");
  });

  it("trims the dashes a replacement leaves at either end", () => {
    expect(slug("!!wip!!")).toBe("wip");
  });
});

describe("isProtectedBranch", () => {
  it("protects the shared branch and main", () => {
    expect(isProtectedBranch("production")).toBe(true);
    expect(isProtectedBranch("main")).toBe(true);
  });

  it("protects any CI branch", () => {
    expect(isProtectedBranch("pr-89")).toBe(true);
  });

  it("leaves a machine branch and an issue branch alone", () => {
    expect(isProtectedBranch("unraid/issue-141")).toBe(false);
    expect(isProtectedBranch("issue-141")).toBe(false);
  });
});

describe("isOwnBranchName", () => {
  it("matches a branch under this machine's prefix", () => {
    expect(isOwnBranchName("unraid/issue-141", "unraid/")).toBe(true);
  });

  it("does not match another machine whose name starts the same", () => {
    expect(isOwnBranchName("unraid-2/issue-141", "unraid/")).toBe(false);
  });

  it("does not match a shared branch, which carries no prefix", () => {
    expect(isOwnBranchName("production", "unraid/")).toBe(false);
  });
});

describe("machineId", () => {
  const machine = process.env["MATCHDAY_MACHINE"];

  afterEach(() => {
    if (machine === undefined) {
      delete process.env["MATCHDAY_MACHINE"];
      return;
    }
    process.env["MATCHDAY_MACHINE"] = machine;
  });

  it("prefers MATCHDAY_MACHINE, slugged", () => {
    process.env["MATCHDAY_MACHINE"] = "Dejan's Laptop";

    expect(machineId()).toBe("dejan-s-laptop");
  });
});

describe("branchName", () => {
  const machine = process.env["MATCHDAY_MACHINE"];

  beforeEach(() => {
    process.env["MATCHDAY_MACHINE"] = "unraid";
  });

  afterEach(() => {
    if (machine === undefined) {
      delete process.env["MATCHDAY_MACHINE"];
      return;
    }
    process.env["MATCHDAY_MACHINE"] = machine;
  });

  it("names the branch after the machine and the git branch", () => {
    expect(branchName("test/scripts-coverage")).toBe("unraid/test/scripts-coverage");
  });

  // Two machines on the same git branch must not land on one database.
  it("gives two machines on one git branch two names", () => {
    const first = branchName("main");
    process.env["MATCHDAY_MACHINE"] = "laptop";

    expect(branchName("main")).not.toBe(first);
  });
});

describe("cappedExpiryDays", () => {
  it("caps a longer ask at the maximum, so nothing outlives the cap", () => {
    expect(cappedExpiryDays(90)).toBe(neonBranchValue.maxExpiryDays);
  });

  it("gives a day to an ask of zero or less", () => {
    expect(cappedExpiryDays(0)).toBe(1);
    expect(cappedExpiryDays(-5)).toBe(1);
  });

  it("leaves a reasonable ask alone", () => {
    expect(cappedExpiryDays(3)).toBe(3);
  });
});

describe("expiryTimestamp", () => {
  const now = new Date("2026-09-09T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an absolute time that many days out, since Neon takes no duration", () => {
    expect(expiryTimestamp(3)).toBe("2026-09-12T00:00:00.000Z");
  });

  it("caps a longer ask at the maximum, so nothing outlives the cap", () => {
    expect(expiryTimestamp(90)).toBe(expiryTimestamp(neonBranchValue.maxExpiryDays));
  });

  it("gives a day to an ask of zero or less, rather than expiring in the past", () => {
    expect(expiryTimestamp(0)).toBe("2026-09-10T00:00:00.000Z");
    expect(expiryTimestamp(-5)).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("splitCommand", () => {
  it("splits a command into its binary and the rest", () => {
    expect(splitCommand(["vp", "run", "db:migrate"])).toEqual(["vp", ["run", "db:migrate"]]);
  });

  it("gives a binary with no arguments an empty list", () => {
    expect(splitCommand(["vp"])).toEqual(["vp", []]);
  });

  it("refuses an empty command rather than shelling out to undefined", () => {
    expect(() => splitCommand([])).toThrow("A command requires a binary.");
  });
});

describe("withRetries", () => {
  it("runs once when the command works", () => {
    const run = vi.fn();
    const wait = vi.fn();

    withRetries(run, wait, 3);

    expect(run).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  // The case this exists for: a Neon branch whose compute is still coming up.
  it("waits and tries again until the command works", () => {
    const run = vi.fn().mockImplementationOnce(failing).mockImplementationOnce(failing);
    const wait = vi.fn();

    withRetries(run, wait, 5);

    expect(run).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("counts the attempts it has made, so it can say so", () => {
    const wait = vi.fn();

    withRetries(vi.fn().mockImplementationOnce(failing), wait, 3);

    expect(wait).toHaveBeenCalledWith(1);
  });

  it("rethrows the last failure once the attempts run out", () => {
    const wait = vi.fn();

    expect(() => {
      withRetries(failing, wait, 3);
    }).toThrow("not accepting connections");
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("does not wait after the last attempt, since nothing follows it", () => {
    const wait = vi.fn();

    expect(() => {
      withRetries(failing, wait, 1);
    }).toThrow();
    expect(wait).not.toHaveBeenCalled();
  });
});

function failing(): never {
  throw new Error("not accepting connections");
}
