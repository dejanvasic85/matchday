import { ok } from "@matchday/domain";
import { dispatchWorkflow, type DispatchWorkflowInput } from "#workflowDispatcher.ts";

const input: DispatchWorkflowInput = {
  owner: "dejanvasic85",
  repo: "matchday",
  workflow: "crawl-leagues.yml",
  ref: "main",
  token: "ghp_test",
};

describe("dispatchWorkflow", () => {
  it("POSTs to the workflow's dispatches endpoint with the ref", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await dispatchWorkflow(fetchImpl, input);

    expect(result).toEqual(ok(undefined));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/dejanvasic85/matchday/actions/workflows/crawl-leagues.yml/dispatches",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ ref: "main" }) }),
    );
  });

  it("sends the bearer token and a user agent, which GitHub rejects requests without", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await dispatchWorkflow(fetchImpl, input);

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init.headers).toMatchObject({
      authorization: "Bearer ghp_test",
      "user-agent": "matchday-scheduler",
    });
  });

  it("surfaces the status and body when GitHub rejects the dispatch", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{"message":"Bad credentials"}', { status: 401 }));

    const result = await dispatchWorkflow(fetchImpl, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("HTTP 401");
      expect(result.error.message).toContain("Bad credentials");
    }
  });

  it("captures a network failure as an error rather than throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await dispatchWorkflow(fetchImpl, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Workflow dispatch for crawl-leagues.yml failed");
    }
  });
});
