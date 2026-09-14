import { err, ok, parseId, type LeagueId, type Logger } from "@matchday/domain";
import { crawlLeagueBatch } from "#services/leagueBatch.ts";

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeLeagueId(suffix: string): LeagueId {
  const leagueId = parseId(`lea_${suffix}`, "league");
  assert(leagueId !== undefined);
  return leagueId;
}

const first = makeLeagueId("aaaaaaaaaaaa");
const second = makeLeagueId("bbbbbbbbbbbb");
const third = makeLeagueId("cccccccccccc");

describe("crawlLeagueBatch", () => {
  it("crawls every league in the chunk, in order", async () => {
    const crawled: LeagueId[] = [];
    const crawlLeague = vi.fn(async (leagueId: LeagueId) => {
      crawled.push(leagueId);
      return ok(undefined);
    });

    const result = await crawlLeagueBatch({ logger: makeLogger(), crawlLeague }, [
      first,
      second,
      third,
    ]);

    expect(crawled).toEqual([first, second, third]);
    expect(result).toEqual(ok({ crawled: 3, failedLeagueIds: [] }));
  });

  it("carries on after a failure so one bad league does not cost the others", async () => {
    const crawlLeague = vi
      .fn()
      .mockResolvedValueOnce(ok(undefined))
      .mockResolvedValueOnce(err({ kind: "server_error", message: "dribl timed out" }))
      .mockResolvedValueOnce(ok(undefined));

    const result = await crawlLeagueBatch({ logger: makeLogger(), crawlLeague }, [
      first,
      second,
      third,
    ]);

    expect(crawlLeague).toHaveBeenCalledTimes(3);
    assert(!result.ok);
    expect(result.error.cause).toEqual({ failedLeagueIds: [second] });
  });

  it("names how many leagues failed out of how many were tried", async () => {
    const crawlLeague = vi
      .fn()
      .mockResolvedValueOnce(err({ kind: "server_error", message: "boom" }))
      .mockResolvedValueOnce(err({ kind: "server_error", message: "boom" }))
      .mockResolvedValueOnce(ok(undefined));

    const result = await crawlLeagueBatch({ logger: makeLogger(), crawlLeague }, [
      first,
      second,
      third,
    ]);

    assert(!result.ok);
    expect(result.error.message).toBe("Failed to crawl 2 of 3 leagues");
  });

  it("logs each failing league so the run tells you which one broke", async () => {
    const logger = makeLogger();
    const crawlLeague = vi
      .fn()
      .mockResolvedValue(err({ kind: "server_error", message: "dribl timed out" }));

    await crawlLeagueBatch({ logger, crawlLeague }, [first]);

    expect(logger.error).toHaveBeenCalledWith(
      "crawlleagues.leaguefailed",
      "dribl timed out",
      expect.objectContaining({ leagueId: first }),
    );
  });

  it("succeeds with nothing crawled when the chunk is empty", async () => {
    const crawlLeague = vi.fn();

    const result = await crawlLeagueBatch({ logger: makeLogger(), crawlLeague }, []);

    expect(result).toEqual(ok({ crawled: 0, failedLeagueIds: [] }));
    expect(crawlLeague).not.toHaveBeenCalled();
  });
});
