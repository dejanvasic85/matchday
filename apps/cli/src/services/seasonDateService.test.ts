import { ok, serverError } from "@matchday/domain";
import {
  describeSeasonDatesFailure,
  setSeasonDates,
  type SeasonDateServiceDeps,
} from "#services/seasonDateService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

function makeSeason() {
  return {
    id: "sea_2026000000",
    source: "dribl" as const,
    name: "2026",
    startsOn: null,
    endsOn: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCompetition() {
  return {
    id: "cmp_npl0000000",
    name: "NPL Victoria",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeWindow() {
  return {
    id: "cse_written000",
    competitionId: "cmp_npl0000000",
    seasonId: "sea_2026000000",
    startsOn: makeIsoDate("2026-03-01"),
    endsOn: makeIsoDate("2026-09-30"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeDeps(overrides: Partial<SeasonDateServiceDeps> = {}): SeasonDateServiceDeps {
  return {
    findSeasonByName: vi.fn().mockResolvedValue(ok(makeSeason())),
    findCompetitionsForSeasonByName: vi.fn().mockResolvedValue(ok([makeCompetition()])),
    updateCompetitionSeasonDates: vi.fn().mockResolvedValue(ok(makeWindow())),
    ...overrides,
  };
}

const validInput = {
  source: "dribl" as const,
  seasonName: "2026",
  competitionName: "NPL Victoria",
  startsOn: "2026-03-01",
  endsOn: "2026-09-30",
};

describe("setSeasonDates", () => {
  it("writes the window to the competition's existing season row", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, validInput);

    expect(result).toEqual(
      ok({
        status: "written",
        source: "dribl",
        seasonName: "2026",
        competitionName: "NPL Victoria",
        startsOn: makeIsoDate("2026-03-01"),
        endsOn: makeIsoDate("2026-09-30"),
      }),
    );
    expect(deps.findSeasonByName).toHaveBeenCalledWith("dribl", "2026");
    expect(deps.findCompetitionsForSeasonByName).toHaveBeenCalledWith(
      "sea_2026000000",
      "NPL Victoria",
    );
    expect(deps.updateCompetitionSeasonDates).toHaveBeenCalledWith({
      competitionId: "cmp_npl0000000",
      seasonId: "sea_2026000000",
      startsOn: "2026-03-01",
      endsOn: "2026-09-30",
    });
  });

  it("fails on a malformed date before touching the database", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, { ...validInput, startsOn: "1 Mar 2026" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("YYYY-MM-DD");
    }
    expect(deps.findSeasonByName).not.toHaveBeenCalled();
  });

  it("fails when the end date is before the start date", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, {
      ...validInput,
      startsOn: "2026-09-30",
      endsOn: "2026-03-01",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("before --starts");
    }
    expect(deps.findSeasonByName).not.toHaveBeenCalled();
  });

  it("reports a missing season rather than writing nothing silently", async () => {
    const deps = makeDeps({ findSeasonByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await setSeasonDates(deps, { ...validInput, seasonName: "2099" });

    expect(result).toEqual(ok({ status: "missing-season" }));
  });

  it("reports a competition that doesn't run the season", async () => {
    const deps = makeDeps({ findCompetitionsForSeasonByName: vi.fn().mockResolvedValue(ok([])) });

    const result = await setSeasonDates(deps, { ...validInput, competitionName: "Typo Cup" });

    expect(result).toEqual(ok({ status: "missing-competition" }));
    expect(deps.updateCompetitionSeasonDates).not.toHaveBeenCalled();
  });

  it("reports an ambiguous competition name with its candidates", async () => {
    const deps = makeDeps({
      findCompetitionsForSeasonByName: vi.fn().mockResolvedValue(
        ok([
          makeCompetition(),
          {
            id: "cmp_other00000",
            name: "NPL Victoria",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      ),
    });

    const result = await setSeasonDates(deps, validInput);

    expect(result).toEqual(
      ok({
        status: "ambiguous-competition",
        candidates: [
          { id: "cmp_npl0000000", name: "NPL Victoria" },
          { id: "cmp_other00000", name: "NPL Victoria" },
        ],
      }),
    );
    expect(deps.updateCompetitionSeasonDates).not.toHaveBeenCalled();
  });

  it("propagates a write failure", async () => {
    const writeError = serverError("Failed to update competition season dates");
    const deps = makeDeps({ updateCompetitionSeasonDates: vi.fn().mockResolvedValue(writeError) });

    const result = await setSeasonDates(deps, validInput);

    expect(result).toEqual(writeError);
  });
});

describe("describeSeasonDatesFailure", () => {
  it("names the source and season that is missing", () => {
    const failure = describeSeasonDatesFailure(
      { status: "missing-season" },
      "dribl",
      "2099",
      "NPL",
    );

    expect(failure.message).toContain('No dribl season named "2099"');
    expect(failure.hint).toContain("mday catalog");
  });

  it("names the competition and season that doesn't run it", () => {
    const failure = describeSeasonDatesFailure(
      { status: "missing-competition" },
      "dribl",
      "2026",
      "Typo Cup",
    );

    expect(failure.message).toContain('No competition named "Typo Cup" runs dribl season "2026"');
  });

  it("lists the candidate ids for an ambiguous competition", () => {
    const failure = describeSeasonDatesFailure(
      {
        status: "ambiguous-competition",
        candidates: [
          { id: "cmp_a", name: "NPL Victoria" },
          { id: "cmp_b", name: "NPL Victoria" },
        ],
      },
      "dribl",
      "2026",
      "NPL Victoria",
    );

    expect(failure.hint).toContain("cmp_a");
    expect(failure.hint).toContain("cmp_b");
  });
});
