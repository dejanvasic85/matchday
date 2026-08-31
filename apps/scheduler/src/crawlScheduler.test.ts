import { ok, serverError } from "@matchday/domain";
import { runCrawlSchedule, type RunCrawlScheduleInput } from "#crawlScheduler.ts";

function makeFakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// Mon 19:00 Melbourne — inside a weekday evening window.
const insideWindow = new Date("2026-08-31T09:00:00Z");
// Mon 10:00 Melbourne — outside every window.
const outsideWindow = new Date("2026-08-31T00:00:00Z");

function makeInput(overrides: Partial<RunCrawlScheduleInput> = {}): RunCrawlScheduleInput {
  return {
    dispatch: vi.fn().mockResolvedValue(ok(undefined)),
    logger: makeFakeLogger(),
    now: insideWindow,
    workflow: "crawl-leagues.yml",
    ...overrides,
  };
}

describe("runCrawlSchedule", () => {
  it("dispatches the workflow inside a game window", async () => {
    const input = makeInput();

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(ok({ dispatched: true, localHour: 19, localWeekday: "Mon" }));
    expect(input.dispatch).toHaveBeenCalledWith("crawl-leagues.yml");
  });

  it("does not dispatch outside a game window", async () => {
    const input = makeInput({ now: outsideWindow });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(ok({ dispatched: false, localHour: 10, localWeekday: "Mon" }));
    expect(input.dispatch).not.toHaveBeenCalled();
  });

  it("logs a skipped tick, so silence never looks the same as a broken scheduler", async () => {
    const input = makeInput({ now: outsideWindow });

    await runCrawlSchedule(input);

    expect(input.logger.debug).toHaveBeenCalledWith(
      "scheduler.skipped",
      "outside a game window, not dispatching",
      expect.objectContaining({ localHour: 10, workflow: "crawl-leagues.yml" }),
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

  it("propagates a dispatch failure and logs it as an error", async () => {
    const dispatchError = serverError("Workflow dispatch for crawl-leagues.yml failed: HTTP 401");
    const input = makeInput({ dispatch: vi.fn().mockResolvedValue(dispatchError) });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(dispatchError);
    expect(input.logger.error).toHaveBeenCalledWith(
      "scheduler.dispatchfailed",
      "Workflow dispatch for crawl-leagues.yml failed: HTTP 401",
      expect.objectContaining({ workflow: "crawl-leagues.yml" }),
    );
  });
});
