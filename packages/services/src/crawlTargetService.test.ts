import { notFound, ok, serverError } from "@matchday/domain";
import type { CrawlTargetLeagueCandidate } from "@matchday/db";
import { addCrawlTargetForLeague, type CrawlTargetServiceDeps } from "#crawlTargetService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

const today = makeIsoDate("2026-06-01");
const targetId = "crt_target0000";

function makeCandidate(
  overrides: Partial<CrawlTargetLeagueCandidate> = {},
): CrawlTargetLeagueCandidate {
  return {
    targetId,
    competitionId: "cmp_npl0000000",
    competitionName: "NPL Victoria",
    targetLeagueName: "U13 YPL1 Boys",
    leagueId: "lea_2026000000",
    leagueName: "U13 YPL1 Boys",
    seasonId: "sea_2026000000",
    seasonName: "2026",
    startsOn: makeIsoDate("2026-02-01"),
    endsOn: makeIsoDate("2026-09-30"),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CrawlTargetServiceDeps> = {}): CrawlTargetServiceDeps {
  return {
    getLeagueById: vi
      .fn()
      .mockResolvedValue(
        ok({ id: "lea_2025000000", name: "U13 YPL1 Boys", competitionId: "cmp_npl0000000" }),
      ),
    upsertCrawlTarget: vi
      .fn()
      .mockResolvedValue(
        ok({ id: targetId, competitionId: "cmp_npl0000000", leagueName: "U13 YPL1 Boys" }),
      ),
    listCrawlTargetLeagueCandidates: vi.fn().mockResolvedValue(ok([makeCandidate()])),
    ...overrides,
  };
}

describe("addCrawlTargetForLeague", () => {
  it("targets the league's competition and name, and reports the edition to crawl", async () => {
    const deps = makeDeps();

    const result = await addCrawlTargetForLeague(deps, "lea_2025000000", today);

    expect(result).toEqual(
      ok({
        id: targetId,
        competitionId: "cmp_npl0000000",
        leagueName: "U13 YPL1 Boys",
        currentLeagueId: "lea_2026000000",
      }),
    );
    expect(deps.upsertCrawlTarget).toHaveBeenCalledWith(
      expect.objectContaining({ competitionId: "cmp_npl0000000", leagueName: "U13 YPL1 Boys" }),
    );
  });

  it("ignores other targets' candidates when picking the edition", async () => {
    const deps = makeDeps({
      listCrawlTargetLeagueCandidates: vi
        .fn()
        .mockResolvedValue(
          ok([makeCandidate({ targetId: "crt_other00000", leagueId: "lea_other00000" })]),
        ),
    });

    const result = await addCrawlTargetForLeague(deps, "lea_2025000000", today);

    expect(result.ok && result.value.currentLeagueId).toBeNull();
  });

  it("reports a null edition when every edition has finished", async () => {
    const deps = makeDeps({
      listCrawlTargetLeagueCandidates: vi.fn().mockResolvedValue(
        ok([
          makeCandidate({
            startsOn: makeIsoDate("2025-02-01"),
            endsOn: makeIsoDate("2025-09-30"),
          }),
        ]),
      ),
    });

    const result = await addCrawlTargetForLeague(deps, "lea_2025000000", today);

    expect(result.ok && result.value.currentLeagueId).toBeNull();
  });

  it("reports an unknown league as not found, without writing", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await addCrawlTargetForLeague(deps, "lea_missing0000", today);

    expect(result).toEqual(notFound("League not found"));
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("passes a write failure through", async () => {
    const failure = serverError("Failed to upsert crawl target");
    const deps = makeDeps({ upsertCrawlTarget: vi.fn().mockResolvedValue(failure) });

    const result = await addCrawlTargetForLeague(deps, "lea_2025000000", today);

    expect(result).toEqual(failure);
  });
});
