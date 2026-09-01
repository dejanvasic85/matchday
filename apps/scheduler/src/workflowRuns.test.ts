import { fetchRecentRuns, type FetchRecentRunsInput } from "#workflowRuns.ts";

const input: FetchRecentRunsInput = {
  owner: "dejanvasic85",
  repo: "matchday",
  workflow: "crawl-leagues.yml",
  token: "ghp_test",
  limit: 2,
};

function makeResponse(runs: { created_at: string; status: string }[]) {
  return new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 });
}

describe("fetchRecentRuns", () => {
  it("asks for the workflow's most recent runs, newest first", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse([]));

    await fetchRecentRuns(fetchImpl, input);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/dejanvasic85/matchday/actions/workflows/crawl-leagues.yml/runs?per_page=2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends the bearer token and a user agent, which GitHub rejects requests without", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse([]));

    await fetchRecentRuns(fetchImpl, input);

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init.headers).toMatchObject({
      authorization: "Bearer ghp_test",
      "user-agent": "matchday-scheduler",
    });
  });

  it("reads the start time and finished state of each run", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeResponse([
        { created_at: "2026-09-01T12:17:41Z", status: "queued" },
        { created_at: "2026-09-01T11:17:41Z", status: "completed" },
      ]),
    );

    const result = await fetchRecentRuns(fetchImpl, input);

    expect(result).toEqual({
      ok: true,
      value: [
        { createdAt: new Date("2026-09-01T12:17:41Z"), active: true },
        { createdAt: new Date("2026-09-01T11:17:41Z"), active: false },
      ],
    });
  });

  it("treats an in-progress run as active, so nothing dispatches on top of it", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        makeResponse([{ created_at: "2026-09-01T12:17:41Z", status: "in_progress" }]),
      );

    const result = await fetchRecentRuns(fetchImpl, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.active).toBe(true);
    }
  });

  it("surfaces the status and body when GitHub rejects the lookup", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{"message":"Bad credentials"}', { status: 401 }));

    const result = await fetchRecentRuns(fetchImpl, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("HTTP 401");
      expect(result.error.message).toContain("Bad credentials");
    }
  });

  it("rejects a body that is not shaped like a run list, rather than guessing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ workflow_runs: [{ status: 7 }] }), { status: 200 }),
      );

    const result = await fetchRecentRuns(fetchImpl, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("unexpected body");
    }
  });

  it("captures a network failure as an error rather than throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await fetchRecentRuns(fetchImpl, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Run lookup for crawl-leagues.yml failed");
    }
  });
});
