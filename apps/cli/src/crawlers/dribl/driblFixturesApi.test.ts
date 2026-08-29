import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import type { DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import { listFixturePages } from "#crawlers/dribl/driblFixturesApi.ts";
import { makeDriblFixture } from "#test/fixtures/driblFixture.ts";

const ids: DriblLeagueIds = { season: "s", competition: "c", league: "l", tenant: "t" };

function makePage(count: number, nextCursor: string | null) {
  return {
    data: Array.from({ length: count }, (_unused, index) =>
      makeDriblFixture({ hash_id: `fixture-${index}` }),
    ),
    meta: { next_cursor: nextCursor },
  };
}

/** Records every URL requested so tests can assert on the cursor chain. */
function makeRecordingPage(responses: unknown[]): { page: FetchPage; urls: string[] } {
  const queue = [...responses];
  const urls: string[] = [];
  return {
    urls,
    page: {
      evaluate: (_fn, url) => {
        urls.push(url);
        const next = queue.shift();
        if (next === undefined) {
          throw new Error("No more fake responses queued");
        }
        return Promise.resolve(JSON.stringify(next));
      },
    },
  };
}

describe("listFixturePages", () => {
  it("follows next_cursor until it is null, returning every page", async () => {
    const { page, urls } = makeRecordingPage([
      makePage(30, "cursor-2"),
      makePage(30, "cursor-3"),
      makePage(5, null),
    ]);

    const result = await listFixturePages({ page, logger: makeFakeLogger(), ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(3);
    expect(result.value.flatMap((response) => response.data)).toHaveLength(65);
    expect(urls[0]?.includes("cursor=")).toBe(false);
    expect(urls[1]).toContain("cursor=cursor-2");
    expect(urls[2]).toContain("cursor=cursor-3");
  });

  it("stops at the first page when there is no next cursor", async () => {
    const page = makeQueuedFakePage([makePage(3, null)]);

    const result = await listFixturePages({ page, logger: makeFakeLogger(), ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(1);
  });

  it("treats a missing meta as the last page rather than failing", async () => {
    const page = makeQueuedFakePage([{ data: [makeDriblFixture()] }]);

    const result = await listFixturePages({ page, logger: makeFakeLogger(), ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(1);
  });

  it("returns no pages when the request matches no fixtures", async () => {
    const page = makeQueuedFakePage([{ data: [], meta: { next_cursor: null } }]);

    const result = await listFixturePages({ page, logger: makeFakeLogger(), ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(0);
  });

  it("drops a trailing empty page instead of returning it", async () => {
    const page = makeQueuedFakePage([
      makePage(30, "cursor-2"),
      { data: [], meta: { next_cursor: null } },
    ]);

    const result = await listFixturePages({ page, logger: makeFakeLogger(), ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(1);
  });

  it("passes extra params through on every page of the chain", async () => {
    const { page, urls } = makeRecordingPage([makePage(30, "cursor-2"), makePage(1, null)]);

    const result = await listFixturePages({
      page,
      logger: makeFakeLogger(),
      ids,
      params: { round: "3" },
      label: "round 3",
    });

    assert(result.ok);
    expect(urls.every((url) => url.includes("round=3"))).toBe(true);
  });

  it("warns and stops once the page cap is hit with a cursor still outstanding", async () => {
    const page = makeQueuedFakePage(Array.from({ length: 50 }, () => makePage(30, "more")));
    const logger = makeFakeLogger();

    const result = await listFixturePages({ page, logger, ids, label: "test" });

    assert(result.ok);
    expect(result.value).toHaveLength(50);
    expect(logger.warn).toHaveBeenCalledWith(
      "crawl.fixturesApi",
      "hit the fixture page cap with more pages available",
      { label: "test", maxFixturePages: 50 },
    );
  });

  it("returns err when a page fails schema validation", async () => {
    const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);

    const result = await listFixturePages({
      page,
      logger: makeFakeLogger(),
      ids,
      label: "round 3",
    });

    assert(!result.ok);
    expect(result.error.message).toContain("round 3");
  });
});
