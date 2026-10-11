import { ok, serverError } from "@matchday/domain";
import {
  addClubCrawlTargets,
  addCrawlTarget,
  describeAddCrawlTargetFailure,
  describeRemoveCrawlTargetFailure,
  listCrawlTargetsSummary,
  removeCrawlTargetById,
  removeCrawlTargetByLeague,
  type AddClubCrawlTargetsDeps,
  type CrawlTargetServiceDeps,
} from "#services/crawlTargetService.ts";
import { makeLeagueWithRefs } from "#test/fixtures/league.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeCompetition(overrides: { id?: string; name?: string } = {}) {
  return {
    id: "cmp_npl0000000",
    name: "NPL Victoria",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeTargetRow(
  overrides: { id?: string; competitionId?: string; leagueName?: string } = {},
) {
  return {
    id: "crt_existing000",
    competitionId: "cmp_npl0000000",
    leagueName: "U13 YPL1 Boys",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CrawlTargetServiceDeps> = {}): CrawlTargetServiceDeps {
  return {
    findCompetitionsBySourceAndName: vi.fn().mockResolvedValue(ok([makeCompetition()])),
    listLeagueNamesByCompetitionId: vi
      .fn()
      .mockResolvedValue(ok(["U13 YPL1 Boys", "U14 YPL1 Boys"])),
    listLeaguesByClubId: vi.fn().mockResolvedValue(ok([])),
    upsertCrawlTarget: vi.fn().mockResolvedValue(ok(makeTargetRow())),
    deleteCrawlTargetById: vi.fn().mockResolvedValue(ok(makeTargetRow())),
    deleteCrawlTargetByLeague: vi.fn().mockResolvedValue(ok(makeTargetRow())),
    listCrawlTargets: vi.fn().mockResolvedValue(
      ok([
        {
          id: "crt_existing000",
          competitionId: "cmp_npl0000000",
          competitionName: "NPL Victoria",
          leagueName: "U13 YPL1 Boys",
        },
      ]),
    ),
    ...overrides,
  };
}

const addInput = {
  source: "dribl" as const,
  competitionName: "NPL Victoria",
  leagueName: "U13 YPL1 Boys",
};

describe("addCrawlTarget", () => {
  it("stores the resolved competition id and the exact league name", async () => {
    const deps = makeDeps();

    const result = await addCrawlTarget(deps, addInput);

    expect(result).toEqual(
      ok({
        status: "added",
        id: expect.stringMatching(/^crt_/),
        competitionId: "cmp_npl0000000",
        competitionName: "NPL Victoria",
        leagueName: "U13 YPL1 Boys",
      }),
    );
    expect(deps.upsertCrawlTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: "cmp_npl0000000",
        leagueName: "U13 YPL1 Boys",
      }),
    );
  });

  it("reports a missing competition and writes nothing", async () => {
    const deps = makeDeps({
      findCompetitionsBySourceAndName: vi.fn().mockResolvedValue(ok([])),
    });

    const result = await addCrawlTarget(deps, addInput);

    expect(result).toEqual(ok({ status: "missing-competition" }));
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("fails listing candidates when more than one competition matches", async () => {
    const deps = makeDeps({
      findCompetitionsBySourceAndName: vi
        .fn()
        .mockResolvedValue(
          ok([
            makeCompetition({ id: "cmp_one0000000", name: "NPL Victoria" }),
            makeCompetition({ id: "cmp_two0000000", name: "NPL Victoria" }),
          ]),
        ),
    });

    const result = await addCrawlTarget(deps, addInput);

    expect(result).toEqual(
      ok({
        status: "ambiguous-competition",
        candidates: [
          { id: "cmp_one0000000", name: "NPL Victoria" },
          { id: "cmp_two0000000", name: "NPL Victoria" },
        ],
      }),
    );
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("reports a league name that no league under the competition has", async () => {
    const deps = makeDeps({
      listLeagueNamesByCompetitionId: vi.fn().mockResolvedValue(ok(["U14 YPL1 Boys"])),
    });

    const result = await addCrawlTarget(deps, addInput);

    expect(result).toEqual(ok({ status: "missing-league" }));
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("passes a data-access failure through", async () => {
    const deps = makeDeps({
      findCompetitionsBySourceAndName: vi.fn().mockResolvedValue(serverError("db down")),
    });

    const result = await addCrawlTarget(deps, addInput);

    expect(result.ok).toBe(false);
  });
});

describe("addClubCrawlTargets", () => {
  const clubInput = { clubName: "Brunswick City SC", seasonId: "sea_2026000000" };

  function makeClubDeps(overrides: Partial<AddClubCrawlTargetsDeps> = {}): AddClubCrawlTargetsDeps {
    return {
      findClubsByName: vi
        .fn()
        .mockResolvedValue(ok([{ id: "clb_brunswick00", name: "Brunswick City SC" }])),
      listLeaguesByClubId: vi.fn().mockResolvedValue(ok([])),
      listCrawlTargets: vi.fn().mockResolvedValue(ok([])),
      upsertCrawlTarget: vi.fn().mockResolvedValue(ok(makeTargetRow())),
      ...overrides,
    };
  }

  it("adds a target per distinct league the club plays in", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(
        ok([
          makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" }),
          makeLeagueWithRefs({
            id: "lea_div2south",
            name: "Div 2 South",
            competitionId: "cmp_state00000",
            competition: {
              id: "cmp_state00000",
              name: "State League",
              createdAt: epoch,
              updatedAt: epoch,
            },
          }),
        ]),
      ),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result).toEqual(
      ok({
        club: { id: "clb_brunswick00", name: "Brunswick City SC" },
        added: [
          { competitionName: "Senol NPL Victoria Men", leagueName: "Div 1 North" },
          { competitionName: "State League", leagueName: "Div 2 South" },
        ],
        alreadyTargeted: [],
        dryRun: false,
      }),
    );
    expect(deps.upsertCrawlTarget).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ competitionId: "cmp_abc123", leagueName: "Div 1 North" }),
    );
    expect(deps.upsertCrawlTarget).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ competitionId: "cmp_state00000", leagueName: "Div 2 South" }),
    );
  });

  it("scopes league discovery to the given season", async () => {
    const deps = makeClubDeps();

    await addClubCrawlTargets(deps, clubInput);

    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_brunswick00", "sea_2026000000");
  });

  it("collapses the one-row-per-team duplicate a league appears as", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi
        .fn()
        .mockResolvedValue(
          ok([
            makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" }),
            makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" }),
          ]),
        ),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result.ok && result.value.added).toHaveLength(1);
    expect(deps.upsertCrawlTarget).toHaveBeenCalledTimes(1);
  });

  it("keeps the same league name under two competitions as two targets", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(
        ok([
          makeLeagueWithRefs({
            id: "lea_one000000",
            name: "Div 1 North",
            competitionId: "cmp_one",
          }),
          makeLeagueWithRefs({
            id: "lea_two000000",
            name: "Div 1 North",
            competitionId: "cmp_two",
            competition: {
              id: "cmp_two",
              name: "Another Cup",
              createdAt: epoch,
              updatedAt: epoch,
            },
          }),
        ]),
      ),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result.ok && result.value.added).toHaveLength(2);
    expect(deps.upsertCrawlTarget).toHaveBeenCalledTimes(2);
  });

  it("reports a league already in scope without rewriting it", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(
        ok([
          makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" }),
          makeLeagueWithRefs({
            id: "lea_div2south",
            name: "Div 2 South",
            competitionId: "cmp_state00000",
            competition: {
              id: "cmp_state00000",
              name: "State League",
              createdAt: epoch,
              updatedAt: epoch,
            },
          }),
        ]),
      ),
      listCrawlTargets: vi.fn().mockResolvedValue(
        ok([
          {
            id: "crt_existing000",
            competitionId: "cmp_abc123",
            competitionName: "Senol NPL Victoria Men",
            leagueName: "Div 1 North",
          },
        ]),
      ),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result.ok && result.value.alreadyTargeted).toEqual([
      { competitionName: "Senol NPL Victoria Men", leagueName: "Div 1 North" },
    ]);
    expect(result.ok && result.value.added).toEqual([
      { competitionName: "State League", leagueName: "Div 2 South" },
    ]);
    expect(deps.upsertCrawlTarget).toHaveBeenCalledTimes(1);
  });

  it("reports what would be added on a dry run without writing", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi
        .fn()
        .mockResolvedValue(ok([makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" })])),
    });

    const result = await addClubCrawlTargets(deps, { ...clubInput, dryRun: true });

    expect(result.ok && result.value.added).toEqual([
      { competitionName: "Senol NPL Victoria Men", leagueName: "Div 1 North" },
    ]);
    expect(result.ok && result.value.dryRun).toBe(true);
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("fails listing candidates when the club name matches more than one club", async () => {
    const deps = makeClubDeps({
      findClubsByName: vi.fn().mockResolvedValue(
        ok([
          { id: "clb_brunswick00", name: "Brunswick City SC" },
          { id: "clb_juventus000", name: "Brunswick Juventus FC" },
        ]),
      ),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result.ok).toBe(false);
    expect(result.ok || result.error.message).toContain("matches more than one club");
    expect(deps.listLeaguesByClubId).not.toHaveBeenCalled();
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });

  it("propagates a league listing failure", async () => {
    const deps = makeClubDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(serverError("db down")),
    });

    const result = await addClubCrawlTargets(deps, clubInput);

    expect(result.ok).toBe(false);
    expect(deps.upsertCrawlTarget).not.toHaveBeenCalled();
  });
});

describe("removeCrawlTargetById", () => {
  it("removes the target and returns its id", async () => {
    const deps = makeDeps();

    const result = await removeCrawlTargetById(deps, "crt_existing000");

    expect(result).toEqual(ok({ status: "removed", id: "crt_existing000" }));
  });

  it("reports not found when the id does not exist", async () => {
    const deps = makeDeps({ deleteCrawlTargetById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await removeCrawlTargetById(deps, "crt_missing0000");

    expect(result).toEqual(ok({ status: "not-found" }));
  });
});

describe("removeCrawlTargetByLeague", () => {
  it("removes the target by its competition and league names", async () => {
    const deps = makeDeps();

    const result = await removeCrawlTargetByLeague(deps, addInput);

    expect(result).toEqual(ok({ status: "removed", id: "crt_existing000" }));
    expect(deps.deleteCrawlTargetByLeague).toHaveBeenCalledWith("cmp_npl0000000", "U13 YPL1 Boys");
  });

  it("reports not found when the competition does not exist", async () => {
    const deps = makeDeps({
      findCompetitionsBySourceAndName: vi.fn().mockResolvedValue(ok([])),
    });

    const result = await removeCrawlTargetByLeague(deps, addInput);

    expect(result).toEqual(ok({ status: "not-found" }));
    expect(deps.deleteCrawlTargetByLeague).not.toHaveBeenCalled();
  });

  it("fails listing candidates when the competition name is ambiguous", async () => {
    const deps = makeDeps({
      findCompetitionsBySourceAndName: vi
        .fn()
        .mockResolvedValue(
          ok([
            makeCompetition({ id: "cmp_one0000000", name: "NPL Victoria" }),
            makeCompetition({ id: "cmp_two0000000", name: "NPL Victoria" }),
          ]),
        ),
    });

    const result = await removeCrawlTargetByLeague(deps, addInput);

    expect(result).toEqual(
      ok({
        status: "ambiguous-competition",
        candidates: [
          { id: "cmp_one0000000", name: "NPL Victoria" },
          { id: "cmp_two0000000", name: "NPL Victoria" },
        ],
      }),
    );
    expect(deps.deleteCrawlTargetByLeague).not.toHaveBeenCalled();
  });
});

describe("listCrawlTargetsSummary", () => {
  it("returns each target as a flat summary", async () => {
    const deps = makeDeps();

    const result = await listCrawlTargetsSummary(deps);

    expect(result).toEqual(
      ok([
        {
          id: "crt_existing000",
          competitionId: "cmp_npl0000000",
          competitionName: "NPL Victoria",
          leagueName: "U13 YPL1 Boys",
        },
      ]),
    );
  });
});

describe("describeAddCrawlTargetFailure", () => {
  it("names the missing competition and the next step", () => {
    const failure = describeAddCrawlTargetFailure(
      { status: "missing-competition" },
      "dribl",
      "NPL Victoria",
      "U13 YPL1 Boys",
    );

    expect(failure.message).toContain('No dribl competition named "NPL Victoria"');
    expect(failure.hint).toContain("mday catalog");
  });

  it("lists the ambiguous candidates", () => {
    const failure = describeAddCrawlTargetFailure(
      {
        status: "ambiguous-competition",
        candidates: [{ id: "cmp_one0000000", name: "NPL Victoria" }],
      },
      "dribl",
      "NPL Victoria",
      "U13 YPL1 Boys",
    );

    expect(failure.hint).toContain("cmp_one0000000");
  });

  it("names the missing league", () => {
    const failure = describeAddCrawlTargetFailure(
      { status: "missing-league" },
      "dribl",
      "NPL Victoria",
      "U13 YPL1 Boys",
    );

    expect(failure.message).toContain('No league named "U13 YPL1 Boys"');
  });
});

describe("describeRemoveCrawlTargetFailure", () => {
  it("names what was not found and the next step", () => {
    const failure = describeRemoveCrawlTargetFailure(
      { status: "not-found" },
      "dribl",
      "NPL Victoria",
      "U13 YPL1 Boys",
    );

    expect(failure.message).toContain("No crawl target");
    expect(failure.hint).toContain("mday crawl-target list");
  });
});
