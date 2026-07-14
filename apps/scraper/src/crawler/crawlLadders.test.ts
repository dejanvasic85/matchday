import { makeFakeLogger } from "../../test/fixtures/logger.ts";
import { makeQueuedFakePage } from "../../test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "../../test/fixtures/rawStorage.ts";
import type { DriblLeagueIds } from "./buildDriblApiUrl.ts";
import { crawlLadders } from "./crawlLadders.ts";

const ids: DriblLeagueIds = { season: "s", competition: "c", league: "l", tenant: "t" };

function makeLadderEntry() {
  return {
    type: "ladder-entry" as const,
    id: "ladder-1",
    attributes: {
      team_hash_id: "team-1",
      team_name: "Home",
      club_name: "Home FC",
      club_logo: "https://ocean.dribl.com/logo",
      season_name: "2026",
      league_name: "League",
      position: 1,
      played: 5,
      won: 4,
      drawn: 1,
      lost: 0,
      goals_for: 10,
      goals_against: 2,
      goal_difference: 8,
      points: 13,
    },
  };
}

describe("crawlLadders", () => {
  it("stages the ladder response to R2 when entries are present", async () => {
    const page = makeQueuedFakePage([{ data: [makeLadderEntry()] }]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlLadders({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      trackedCompetitionId: "trk_abc",
      crawlRunId: "run_1",
    });

    expect(result.ok).toBe(true);
    expect(rawStorage.puts).toHaveLength(1);
    expect(rawStorage.puts[0]?.key).toBe("raw/trk_abc/run_1/ladders.json");
  });

  it("skips staging and returns undefined when there are no ladder entries", async () => {
    const page = makeQueuedFakePage([{ data: [] }]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlLadders({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      trackedCompetitionId: "trk_abc",
      crawlRunId: "run_1",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(rawStorage.puts).toHaveLength(0);
  });

  it("returns err when the response fails schema validation", async () => {
    const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlLadders({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      trackedCompetitionId: "trk_abc",
      crawlRunId: "run_1",
    });

    expect(result.ok).toBe(false);
  });
});
