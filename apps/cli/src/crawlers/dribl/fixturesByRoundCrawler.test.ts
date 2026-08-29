import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "#test/fixtures/rawStorage.ts";
import { makeDriblFixture, makeDriblFixtureAttributes } from "#test/fixtures/driblFixture.ts";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import type { DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import { crawlFixturesByRound } from "#crawlers/dribl/fixturesByRoundCrawler.ts";

const ids: DriblLeagueIds = { season: "s", competition: "c", league: "l", tenant: "t" };

function makeFixtureResponse(count: number, nextCursor: string | null = null) {
  return {
    data: Array.from({ length: count }, (_unused, index) =>
      makeDriblFixture({
        hash_id: `fixture-${index}`,
        attributes: makeDriblFixtureAttributes({ name: `Fixture ${index}` }),
      }),
    ),
    meta: { next_cursor: nextCursor },
  };
}

const emptyResponse = { data: [], meta: { next_cursor: null } };

describe("crawlFixturesByRound", () => {
  describe("tabled leagues (sequential round scan)", () => {
    it("stages each non-empty round to R2 and stops after two consecutive empty rounds", async () => {
      const page = makeQueuedFakePage([
        makeFixtureResponse(2),
        makeFixtureResponse(1),
        emptyResponse,
        emptyResponse,
      ]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(result.ok);
      expect(rawStorage.puts).toHaveLength(2);
      expect(rawStorage.puts[0]?.key).toBe("deep/lea_abc123/run_1/fixtures-round-1-page-1.json");
      expect(rawStorage.puts[1]?.key).toBe("deep/lea_abc123/run_1/fixtures-round-2-page-1.json");
    });

    it("stages every page of a round that spans more than one cursor page", async () => {
      const page = makeQueuedFakePage([
        makeFixtureResponse(30, "cursor-2"),
        makeFixtureResponse(4),
        emptyResponse,
        emptyResponse,
      ]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(result.ok);
      expect(result.value.flatMap((response) => response.data)).toHaveLength(34);
      expect(rawStorage.puts.map((put) => put.key)).toEqual([
        "deep/lea_abc123/run_1/fixtures-round-1-page-1.json",
        "deep/lea_abc123/run_1/fixtures-round-1-page-2.json",
      ]);
    });

    it("continues past a single empty round (scheduling gap, not season end)", async () => {
      const page = makeQueuedFakePage([
        makeFixtureResponse(1),
        emptyResponse,
        makeFixtureResponse(1),
        emptyResponse,
        emptyResponse,
      ]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(result.ok);
      expect(rawStorage.puts).toHaveLength(2);
    });

    it("stages a round containing an unstructured placeholder fixture (null name)", async () => {
      const response = {
        data: [makeDriblFixture({ attributes: makeDriblFixtureAttributes({ name: null }) })],
        meta: { next_cursor: null },
      };
      const page = makeQueuedFakePage([response, emptyResponse, emptyResponse]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(result.ok);
      expect(rawStorage.puts).toHaveLength(1);
    });

    it("returns err when a round's response fails schema validation", async () => {
      const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(!result.ok);
      expect(rawStorage.puts).toHaveLength(0);
    });

    it("warns when the crawl hits the maxRounds safety cap without a natural stop", async () => {
      const page = makeQueuedFakePage(Array.from({ length: 40 }, () => makeFixtureResponse(1)));
      const rawStorage = makeFakeRawStorage();
      const logger = makeFakeLogger();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger,
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: true,
      });

      assert(result.ok);
      expect(logger.warn).toHaveBeenCalledWith(
        "crawl.fixturesRound",
        "hit maxRounds safety cap without a natural stop",
        { maxRounds: 40 },
      );
    });
  });

  describe("table-less leagues (current fixture window)", () => {
    it("fetches fixtures with no round filter and stages a single response", async () => {
      const requestedUrls: string[] = [];
      const page: FetchPage = {
        evaluate: (_fn, arg) => {
          requestedUrls.push(arg);
          return Promise.resolve(JSON.stringify(makeFixtureResponse(3)));
        },
      };
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: false,
      });

      assert(result.ok);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.data).toHaveLength(3);
      expect(rawStorage.puts).toHaveLength(1);
      expect(rawStorage.puts[0]?.key).toBe("deep/lea_abc123/run_1/fixtures-window-page-1.json");
      expect(requestedUrls.some((url) => url.includes("round="))).toBe(false);
    });

    it("follows the cursor past the first 30 so later rounds are not dropped", async () => {
      const page = makeQueuedFakePage([
        makeFixtureResponse(30, "cursor-2"),
        makeFixtureResponse(30, "cursor-3"),
        makeFixtureResponse(25),
      ]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: false,
      });

      assert(result.ok);
      expect(result.value.flatMap((response) => response.data)).toHaveLength(85);
      expect(rawStorage.puts.map((put) => put.key)).toEqual([
        "deep/lea_abc123/run_1/fixtures-window-page-1.json",
        "deep/lea_abc123/run_1/fixtures-window-page-2.json",
        "deep/lea_abc123/run_1/fixtures-window-page-3.json",
      ]);
    });

    it("returns an empty array without staging when the current window has no fixtures", async () => {
      const page = makeQueuedFakePage([emptyResponse]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: false,
      });

      assert(result.ok);
      expect(result.value).toHaveLength(0);
      expect(rawStorage.puts).toHaveLength(0);
    });

    it("returns err when the current window's response fails schema validation", async () => {
      const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);
      const rawStorage = makeFakeRawStorage();

      const result = await crawlFixturesByRound({
        page,
        rawStorage,
        logger: makeFakeLogger(),
        ids,
        leagueId: "lea_abc123",
        crawlRunId: "run_1",
        hasTable: false,
      });

      assert(!result.ok);
      expect(rawStorage.puts).toHaveLength(0);
    });
  });
});
