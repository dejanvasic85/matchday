import { ok, serverError } from "@matchday/domain";
import {
  runCrawlSchedule,
  type CrawlSchedule,
  type RunCrawlScheduleInput,
} from "#crawlScheduler.ts";

function makeFakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// The windows themselves are covered in crawlWindow.test.ts; these stubs keep this suite about
// orchestration alone, so a change to the game hours never breaks it.
const tick = new Date("2026-08-31T09:00:00Z");

function makeSchedule(workflow: string, shouldCrawl: boolean): CrawlSchedule {
  return {
    workflow,
    decide: vi.fn().mockReturnValue({ shouldCrawl, localHour: 19, localWeekday: "Mon" }),
  };
}

const leaguesDue = makeSchedule("crawl-leagues.yml", true);
const catalogDue = makeSchedule("crawl-catalog.yml", true);
const catalogNotDue = makeSchedule("crawl-catalog.yml", false);

function makeInput(overrides: Partial<RunCrawlScheduleInput> = {}): RunCrawlScheduleInput {
  return {
    dispatch: vi.fn().mockResolvedValue(ok(undefined)),
    logger: makeFakeLogger(),
    now: tick,
    schedules: [leaguesDue, catalogNotDue],
    ...overrides,
  };
}

describe("runCrawlSchedule", () => {
  it("dispatches only the workflows due on this tick", async () => {
    const input = makeInput();

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(
      ok([
        { workflow: "crawl-leagues.yml", dispatched: true, localHour: 19, localWeekday: "Mon" },
        { workflow: "crawl-catalog.yml", dispatched: false, localHour: 19, localWeekday: "Mon" },
      ]),
    );
    expect(input.dispatch).toHaveBeenCalledExactlyOnceWith("crawl-leagues.yml");
  });

  it("decides every schedule against the tick it was given", async () => {
    const schedules = [
      makeSchedule("crawl-leagues.yml", true),
      makeSchedule("crawl-catalog.yml", false),
    ];
    const input = makeInput({ schedules });

    await runCrawlSchedule(input);

    for (const schedule of schedules) {
      expect(schedule.decide).toHaveBeenCalledExactlyOnceWith(tick);
    }
  });

  it("dispatches both when the weekly catalog slot lands inside a game window", async () => {
    const input = makeInput({ schedules: [leaguesDue, catalogDue] });

    await runCrawlSchedule(input);

    expect(input.dispatch).toHaveBeenCalledWith("crawl-leagues.yml");
    expect(input.dispatch).toHaveBeenCalledWith("crawl-catalog.yml");
  });

  it("dispatches nothing when no schedule is due", async () => {
    const input = makeInput({ schedules: [makeSchedule("crawl-leagues.yml", false)] });

    const result = await runCrawlSchedule(input);

    expect(result).toEqual(
      ok([
        { workflow: "crawl-leagues.yml", dispatched: false, localHour: 19, localWeekday: "Mon" },
      ]),
    );
    expect(input.dispatch).not.toHaveBeenCalled();
  });

  it("logs a skipped tick, so silence never looks the same as a broken scheduler", async () => {
    const input = makeInput();

    await runCrawlSchedule(input);

    expect(input.logger.debug).toHaveBeenCalledWith(
      "scheduler.skipped",
      "outside a crawl window, not dispatching",
      expect.objectContaining({ localHour: 19, workflow: "crawl-catalog.yml" }),
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

  it("still dispatches the league crawl when the catalog dispatch fails first", async () => {
    const dispatchError = serverError("Workflow dispatch for crawl-catalog.yml failed: HTTP 401");
    const dispatch = vi
      .fn()
      .mockImplementation(async (workflow: string) =>
        workflow === "crawl-catalog.yml" ? dispatchError : ok(undefined),
      );
    const input = makeInput({ dispatch, schedules: [catalogDue, leaguesDue] });

    const result = await runCrawlSchedule(input);

    expect(dispatch).toHaveBeenCalledWith("crawl-leagues.yml");
    expect(result).toEqual(dispatchError);
  });
});
