import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";

function makeFakePage(evaluate: FetchPage["evaluate"]): FetchPage {
  return { evaluate };
}

describe("browserFetch", () => {
  it("returns parsed JSON on success", async () => {
    const page = makeFakePage(async (fn) => fn("https://example.com"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{"data":[]}') }),
    );

    const result = await browserFetch(page, "https://example.com");

    expect(result).toEqual({ ok: true, value: { data: [] } });
    vi.unstubAllGlobals();
  });

  it("returns err when the underlying evaluate call throws", async () => {
    const page = makeFakePage(() => Promise.reject(new Error("boom")));

    const result = await browserFetch(page, "https://example.com");

    assert(!result.ok);
  });
});
