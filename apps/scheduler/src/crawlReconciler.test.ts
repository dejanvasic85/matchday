import { decideDispatch, type DecideDispatchInput } from "#crawlReconciler.ts";
import type { WorkflowRunSummary } from "#workflowRuns.ts";

const now = new Date("2026-09-01T12:00:00Z");
const hourMs = 60 * 60 * 1000;

function makeRun(overrides: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary {
  return { createdAt: new Date("2026-09-01T11:00:00Z"), active: false, ...overrides };
}

function makeInput(overrides: Partial<DecideDispatchInput> = {}): DecideDispatchInput {
  return { now, inWindow: true, minIntervalMs: 55 * 60 * 1000, runs: [], ...overrides };
}

describe("decideDispatch", () => {
  it("dispatches when the window is open and the workflow has never run", () => {
    const decision = decideDispatch(makeInput());

    expect(decision).toEqual({ dispatch: true, reason: "due", lastRunAt: undefined });
  });

  it("dispatches once the minimum interval has passed since the last run", () => {
    // Last run an hour ago, interval 55 minutes.
    const decision = decideDispatch(makeInput({ runs: [makeRun()] }));

    expect(decision.dispatch).toBe(true);
    expect(decision.reason).toBe("due");
  });

  it("does not dispatch inside the minimum interval", () => {
    const runs = [makeRun({ createdAt: new Date("2026-09-01T11:30:00Z") })];

    const decision = decideDispatch(makeInput({ runs }));

    expect(decision.dispatch).toBe(false);
    expect(decision.reason).toBe("ran-recently");
    expect(decision.lastRunAt).toEqual(new Date("2026-09-01T11:30:00Z"));
  });

  it("does not dispatch outside the window, whatever the history says", () => {
    const decision = decideDispatch(makeInput({ inWindow: false, runs: [] }));

    expect(decision).toEqual({ dispatch: false, reason: "outside-window" });
  });

  it("does not dispatch while a run is still queued or in progress", () => {
    const runs = [makeRun({ createdAt: new Date("2026-08-25T00:00:00Z"), active: true })];

    const decision = decideDispatch(makeInput({ runs }));

    expect(decision.dispatch).toBe(false);
    expect(decision.reason).toBe("run-active");
  });

  it("catches up a missed run rather than waiting out another interval", () => {
    // The weekly catalog crawl: last run 8 days ago, so a dropped tick has already cost a week.
    const runs = [makeRun({ createdAt: new Date("2026-08-24T12:00:00Z") })];

    const decision = decideDispatch(makeInput({ runs, minIntervalMs: 6 * 24 * hourMs }));

    expect(decision.dispatch).toBe(true);
  });

  it("compares against the newest run, whatever order they arrive in", () => {
    const runs = [
      makeRun({ createdAt: new Date("2026-09-01T09:00:00Z") }),
      makeRun({ createdAt: new Date("2026-09-01T11:45:00Z") }),
    ];

    const decision = decideDispatch(makeInput({ runs }));

    expect(decision.reason).toBe("ran-recently");
    expect(decision.lastRunAt).toEqual(new Date("2026-09-01T11:45:00Z"));
  });
});
