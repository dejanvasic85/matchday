import { crawlTargetSchema } from "#entities/crawlTarget.ts";

function makeValidCrawlTarget() {
  return {
    id: "crt_abc123",
    competitionId: "cmp_abc123",
    leagueName: "U13 YPL1 Boys",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("crawlTargetSchema", () => {
  it("accepts a valid crawl target", () => {
    const result = crawlTargetSchema.safeParse(makeValidCrawlTarget());

    expect(result.success).toBe(true);
  });

  it("rejects a crawl target missing a competition", () => {
    const { competitionId: _competitionId, ...withoutCompetition } = makeValidCrawlTarget();

    const result = crawlTargetSchema.safeParse(withoutCompetition);

    expect(result.success).toBe(false);
  });

  it("rejects a crawl target missing a league name", () => {
    const { leagueName: _leagueName, ...withoutLeagueName } = makeValidCrawlTarget();

    const result = crawlTargetSchema.safeParse(withoutLeagueName);

    expect(result.success).toBe(false);
  });
});
