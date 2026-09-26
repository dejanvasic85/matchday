import { ok, serverError } from "@matchday/domain";
import {
  addCrawlTarget,
  describeAddCrawlTargetFailure,
  describeRemoveCrawlTargetFailure,
  listCrawlTargetsSummary,
  removeCrawlTargetById,
  removeCrawlTargetByLeague,
  type CrawlTargetServiceDeps,
} from "#services/crawlTargetService.ts";

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
