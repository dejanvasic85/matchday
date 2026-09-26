import { ok, serverError, type Result } from "@matchday/domain";
import type { CrawlTargetLeagueCandidate } from "@matchday/db";
import {
  resolveCrawlScope,
  selectCurrentLeague,
  type CrawlScopeDeps,
} from "#services/crawlScopeService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

const today = makeIsoDate("2026-06-01");

function makeCandidate(
  overrides: Partial<CrawlTargetLeagueCandidate> = {},
): CrawlTargetLeagueCandidate {
  return {
    targetId: "crt_target0000",
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

function makeDeps(
  candidates: CrawlTargetLeagueCandidate[] | Result<CrawlTargetLeagueCandidate[]>,
): CrawlScopeDeps {
  return {
    listCrawlTargetLeagueCandidates: vi
      .fn()
      .mockResolvedValue(Array.isArray(candidates) ? ok(candidates) : candidates),
  };
}

describe("selectCurrentLeague", () => {
  it("picks the edition whose window contains today", () => {
    const running = makeCandidate({ seasonName: "2026", leagueId: "lea_2026000000" });
    const upcoming = makeCandidate({
      seasonName: "2027",
      leagueId: "lea_2027000000",
      startsOn: makeIsoDate("2027-02-01"),
      endsOn: makeIsoDate("2027-09-30"),
    });

    const chosen = selectCurrentLeague([upcoming, running], today);

    expect(chosen?.leagueId).toBe("lea_2026000000");
  });

  it("picks the next edition to start when none contains today", () => {
    const finished = makeCandidate({
      seasonName: "2026",
      leagueId: "lea_2026000000",
      startsOn: makeIsoDate("2026-02-01"),
      endsOn: makeIsoDate("2026-05-31"),
    });
    const upcoming = makeCandidate({
      seasonName: "2027",
      leagueId: "lea_2027000000",
      startsOn: makeIsoDate("2027-02-01"),
      endsOn: makeIsoDate("2027-09-30"),
    });

    const chosen = selectCurrentLeague([finished, upcoming], today);

    expect(chosen?.leagueId).toBe("lea_2027000000");
  });

  it("returns null when every dated edition has finished", () => {
    const finished = makeCandidate({
      startsOn: makeIsoDate("2026-02-01"),
      endsOn: makeIsoDate("2026-05-31"),
    });

    expect(selectCurrentLeague([finished], today)).toBeNull();
  });

  it("picks the latest season name when no edition has dates", () => {
    const older = makeCandidate({
      seasonName: "2026",
      leagueId: "lea_2026000000",
      startsOn: null,
      endsOn: null,
    });
    const newer = makeCandidate({
      seasonName: "2027",
      leagueId: "lea_2027000000",
      startsOn: null,
      endsOn: null,
    });

    const chosen = selectCurrentLeague([older, newer], today);

    expect(chosen?.leagueId).toBe("lea_2027000000");
  });

  it("ignores candidates with no league row", () => {
    const missing = makeCandidate({ leagueId: null, leagueName: null, seasonId: null });
    const present = makeCandidate({ leagueId: "lea_2026000000" });

    const chosen = selectCurrentLeague([missing, present], today);

    expect(chosen?.leagueId).toBe("lea_2026000000");
  });

  it("returns null when no candidate has a league row", () => {
    const missing = makeCandidate({ leagueId: null, leagueName: null, seasonId: null });

    expect(selectCurrentLeague([missing], today)).toBeNull();
  });
});

describe("resolveCrawlScope", () => {
  it("returns the current league id for each target", async () => {
    const deps = makeDeps([
      makeCandidate({ targetId: "crt_one0000000", leagueId: "lea_one0000000" }),
      makeCandidate({
        targetId: "crt_two0000000",
        competitionName: "Men's Metropolitan League",
        targetLeagueName: "Men's Metropolitan League 1",
        leagueId: "lea_two0000000",
        leagueName: "Men's Metropolitan League 1",
      }),
    ]);

    const result = await resolveCrawlScope(deps, today);

    expect(result).toEqual(ok({ leagueIds: ["lea_one0000000", "lea_two0000000"], skipped: [] }));
  });

  it("skips a target whose name matches no league, and keeps the rest", async () => {
    const deps = makeDeps([
      makeCandidate({ targetId: "crt_one0000000", leagueId: "lea_one0000000" }),
      makeCandidate({
        targetId: "crt_gone000000",
        competitionName: "NPL Victoria",
        targetLeagueName: "U15 YPL1 Boys",
        leagueId: null,
        leagueName: null,
        seasonId: null,
        seasonName: null,
        startsOn: null,
        endsOn: null,
      }),
    ]);

    const result = await resolveCrawlScope(deps, today);

    expect(result).toEqual(
      ok({
        leagueIds: ["lea_one0000000"],
        skipped: [{ competitionName: "NPL Victoria", leagueName: "U15 YPL1 Boys" }],
      }),
    );
  });

  it("passes a data-access failure through", async () => {
    const deps = makeDeps(serverError("db down"));

    const result = await resolveCrawlScope(deps, today);

    expect(result.ok).toBe(false);
  });
});
