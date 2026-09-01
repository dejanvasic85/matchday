import { ok, serverError } from "@matchday/domain";
import {
  runCrawlSchedule,
  type CrawlSchedule,
  type RunCrawlScheduleInput,
} from "#crawlScheduler.ts";
import type { WorkflowRunSummary } from "#workflowRuns.ts";

function makeFakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// The windows themselves are covered in crawlWindow.test.ts and the due/not-due rule in
// crawlReconciler.test.ts; these stubs keep this suite about orchestration alone.
const tick = new Date("2026-09-01T12:00:00Z");
const hourMs = 60 * 60 * 1000;

function makeSchedule(workflow: string, inWindow: boolean): CrawlSchedule {
  return {
    workflow,
    isInWindow: vi.fn().mockReturnValue({ inWindow, localHour: 19, localWeekday: "Mon" }),
    minIntervalMs: hourMs,
  };
}

/** A run old enough that the schedule is due again. */
function staleRun(): WorkflowRunSummary {
  return { createdAt: new Date("2026-09-01T06:00:00Z"), active: false };
}

const leaguesOpen = makeSchedule("crawl-leagues.yml", true);
const catalogShut = makeSchedule("crawl-catalog.yml", false);

function makeInput(overrides: Partial<RunCrawlScheduleInput> = {}): RunCrawlScheduleInput {
  return {
    dispatch: vi.fn().mockResolvedValue(ok(undefined)),
    listRuns: vi.fn().mockResolvedValue(ok([staleRun()])),
    logger: makeFakeLogger(),
    now: tick,
    schedules: [leaguesOpen, catalogShut],
    ...overrides,
  };
}

describe("runCrawlSchedule", () => {
  it("dispatches a schedule that is in window and due", async () => {
    const input = makeInput();

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(
      ok([
        {
          workflow: "crawl-leagues.yml",
          dispatched: true,
          reason: "due",
          localHour: 19,
          localWeekday: "Mon",
        },
        {
          workflow: "crawl-catalog.yml",
          dispatched: false,
          reason: "outside-window",
          localHour: 19,
          localWeekday: "Mon",
        },
      ]),
    );
    expect(input.dispatch).toHaveBeenCalledExactlyOnceWith("crawl-leagues.yml");
  });

  it("decides every schedule against the tick it was given", async () => {
    const schedules = [leaguesOpen, catalogShut];
    const input = makeInput({ schedules });

    await runCrawlSchedule(input);

    for (const schedule of schedules) {
      expect(schedule.isInWindow).toHaveBeenCalledWith(tick);
    }
  });

  it("does not ask GitHub for runs when the window is shut", async () => {
    const input = makeInput({ schedules: [catalogShut] });

    await runCrawlSchedule(input);

    expect(input.listRuns).not.toHaveBeenCalled();
  });

  it("does not dispatch when the workflow already ran inside its interval", async () => {
    const recent = { createdAt: new Date("2026-09-01T11:30:00Z"), active: false };
    const input = makeInput({
      listRuns: vi.fn().mockResolvedValue(ok([recent])),
      schedules: [leaguesOpen],
    });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(
      ok([
        {
          workflow: "crawl-leagues.yml",
          dispatched: false,
          reason: "ran-recently",
          localHour: 19,
          localWeekday: "Mon",
        },
      ]),
    );
    expect(input.dispatch).not.toHaveBeenCalled();
  });

  it("logs a skipped tick, so silence never looks the same as a broken scheduler", async () => {
    const input = makeInput();

    await runCrawlSchedule(input);

    expect(input.logger.debug).toHaveBeenCalledWith(
      "scheduler.skipped",
      "outside the crawl window",
      expect.objectContaining({ workflow: "crawl-catalog.yml", reason: "outside-window" }),
    );
  });

  it("logs the dispatch on success", async () => {
    const input = makeInput();

    await runCrawlSchedule(input);

    expect(input.logger.info).toHaveBeenCalledWith(
      "scheduler.dispatched",
      "dispatched crawl workflow",
      expect.objectContaining({ workflow: "crawl-leagues.yml", localHour: 19 }),
    );
  });

  it("reports a failed run lookup rather than dispatching blind", async () => {
    const lookupError = serverError("Run lookup for crawl-leagues.yml failed: HTTP 401");
    const input = makeInput({
      listRuns: vi.fn().mockResolvedValue(lookupError),
      schedules: [leaguesOpen],
    });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(lookupError);
    expect(input.dispatch).not.toHaveBeenCalled();
    expect(input.logger.error).toHaveBeenCalledWith(
      "scheduler.lookupfailed",
      "Run lookup for crawl-leagues.yml failed: HTTP 401",
      expect.objectContaining({ workflow: "crawl-leagues.yml" }),
    );
  });

  it("propagates a dispatch failure and logs it as an error", async () => {
    const dispatchError = serverError("Workflow dispatch for crawl-leagues.yml failed: HTTP 401");
    const input = makeInput({
      dispatch: vi.fn().mockResolvedValue(dispatchError),
      schedules: [leaguesOpen],
    });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(dispatchError);
    expect(input.logger.error).toHaveBeenCalledWith(
      "scheduler.dispatchfailed",
      "Workflow dispatch for crawl-leagues.yml failed: HTTP 401",
      expect.objectContaining({ workflow: "crawl-leagues.yml" }),
    );
  });

  it("still dispatches the league crawl when the catalog dispatch fails first", async () => {
    const dispatchError = serverError("Workflow dispatch for crawl-catalog.yml failed: HTTP 401");
    const dispatch = vi
      .fn()
      .mockImplementation(async (workflow: string) =>
        workflow === "crawl-catalog.yml" ? dispatchError : ok(undefined),
      );
    const input = makeInput({
      dispatch,
      schedules: [makeSchedule("crawl-catalog.yml", true), leaguesOpen],
    });

    const result = await runCrawlSchedule(input);

    expect(dispatch).toHaveBeenCalledWith("crawl-leagues.yml");
    expect(result).toEqual(dispatchError);
  });
});
