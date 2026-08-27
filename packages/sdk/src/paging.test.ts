import { fetchAllPages, type Page, type PageFetcher } from "#paging.ts";
import type { FetchOutcome } from "#result.ts";

function outcome<T>(body: Page<T>, status = 200): FetchOutcome<Page<T>> {
  return { data: body, response: new Response(null, { status }) };
}

function failure(status: number, message: string): FetchOutcome<Page<never>> {
  return { error: { error: message }, response: new Response(null, { status }) };
}

function makeFetcher() {
  return vi.fn<PageFetcher<string>>();
}

describe("fetchAllPages", () => {
  it("returns the single page's items when the first page is the last", async () => {
    const fetchPage = makeFetcher().mockResolvedValue(
      outcome({ data: ["a", "b"], nextCursor: null }),
    );

    const result = await fetchAllPages<string>(fetchPage);

    expect(result).toEqual({ ok: true, value: ["a", "b"] });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("asks for the server's max page size and no cursor on the first request", async () => {
    const fetchPage = makeFetcher().mockResolvedValue(outcome({ data: [], nextCursor: null }));

    await fetchAllPages<string>(fetchPage);

    expect(fetchPage).toHaveBeenCalledWith({ cursor: undefined, limit: 500 }, undefined);
  });

  it("feeds each page's nextCursor into the next request", async () => {
    const fetchPage = makeFetcher()
      .mockResolvedValueOnce(outcome({ data: ["a"], nextCursor: "cursor1" }))
      .mockResolvedValueOnce(outcome({ data: ["b"], nextCursor: "cursor2" }))
      .mockResolvedValueOnce(outcome({ data: ["c"], nextCursor: null }));

    const result = await fetchAllPages<string>(fetchPage, { limit: 2 });

    expect(result).toEqual({ ok: true, value: ["a", "b", "c"] });
    expect(fetchPage.mock.calls.map(([query]) => query.cursor)).toEqual([
      undefined,
      "cursor1",
      "cursor2",
    ]);
  });

  it("passes the caller's signal to every page so one abort stops the whole walk", async () => {
    const fetchPage = makeFetcher().mockResolvedValue(outcome({ data: [], nextCursor: null }));
    const { signal } = new AbortController();

    await fetchAllPages<string>(fetchPage, { signal });

    expect(fetchPage).toHaveBeenCalledWith(expect.anything(), signal);
  });

  it("returns the failure rather than a partial list when a later page fails", async () => {
    const fetchPage = makeFetcher()
      .mockResolvedValueOnce(outcome({ data: ["a"], nextCursor: "cursor1" }))
      .mockResolvedValueOnce(failure(400, "Invalid cursor"));

    const result = await fetchAllPages<string>(fetchPage);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ status: 400, message: "Invalid cursor" }),
    });
  });

  it("fails instead of looping forever when the server never returns a null cursor", async () => {
    const fetchPage = makeFetcher().mockResolvedValue(
      outcome({ data: ["a"], nextCursor: "always-more" }),
    );

    const result = await fetchAllPages<string>(fetchPage, { maxPages: 3 });

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        status: 500,
        message: expect.stringContaining("more than 3 pages"),
      }),
    });
  });

  it("collects nothing without failing when the only page is empty", async () => {
    const fetchPage = makeFetcher().mockResolvedValue(outcome({ data: [], nextCursor: null }));

    const result = await fetchAllPages<string>(fetchPage);

    expect(result).toEqual({ ok: true, value: [] });
  });
});
