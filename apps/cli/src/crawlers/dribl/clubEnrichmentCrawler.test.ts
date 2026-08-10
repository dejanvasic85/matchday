import { ok, serverError } from "@matchday/domain";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "#test/fixtures/rawStorage.ts";
import { crawlClubEnrichment } from "./clubEnrichmentCrawler.ts";

const tenantResponse = { data: { id: "tenant-id" } };

function makeClubListAttributes(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Aintree SC",
    image: "https://ocean.dribl.com/logo",
    email: "aintreesc@gmail.com",
    email_address: null,
    url: null,
    color: null,
    accent: null,
    address: null,
    socials: null,
    grounds: null,
    ...overrides,
  };
}

function makeClubDetailResponse(id: string, name: string) {
  return {
    data: {
      type: "clubs",
      id,
      attributes: {
        ...makeClubListAttributes({ name }),
        color: "#F15828",
        accent: "#FFFFFF",
        store: "/club/9294",
        grounds: { name: "Home Ground", address: "1 Main St" },
      },
    },
  };
}

describe("crawlClubEnrichment", () => {
  it("crawls every listed club, stages raw responses, maps them, and streams via onClub", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      {
        data: [
          { type: "clubs", id: "club-1", attributes: makeClubListAttributes({ name: "Club A" }) },
          { type: "clubs", id: "club-2", attributes: makeClubListAttributes({ name: "Club B" }) },
        ],
      },
      makeClubDetailResponse("club-1", "Club A"),
      makeClubDetailResponse("club-2", "Club B"),
    ]);
    const rawStorage = makeFakeRawStorage();
    const onClub = vi.fn().mockResolvedValue(ok(undefined));

    const result = await crawlClubEnrichment({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      crawlRunId: "run_1",
      onClub,
    });

    assert(result.ok);
    expect(result.value.map((c) => c.name)).toEqual(["Club A", "Club B"]);
    expect(result.value[0]?.grounds).toEqual({ name: "Home Ground", address: "1 Main St" });
    expect(rawStorage.puts.map((p) => p.key)).toEqual([
      "club-enrichment/run_1/club-club-1.json",
      "club-enrichment/run_1/club-club-2.json",
    ]);
    expect(onClub).toHaveBeenCalledTimes(2);
  });

  it("propagates a clubs/{id} fetch failure", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      { data: [{ type: "clubs", id: "club-1", attributes: makeClubListAttributes() }] },
      { data: { type: "clubs", id: "club-1" } }, // missing attributes -> fails validation
    ]);

    const result = await crawlClubEnrichment({
      page,
      rawStorage: makeFakeRawStorage(),
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      crawlRunId: "run_1",
    });

    assert(!result.ok);
  });

  it("aborts when onClub returns err", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      { data: [{ type: "clubs", id: "club-1", attributes: makeClubListAttributes() }] },
      makeClubDetailResponse("club-1", "Club A"),
    ]);
    const onClub = vi.fn().mockResolvedValue(serverError("persist failed"));

    const result = await crawlClubEnrichment({
      page,
      rawStorage: makeFakeRawStorage(),
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      crawlRunId: "run_1",
      onClub,
    });

    assert(!result.ok);
  });
});
