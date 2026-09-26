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

function makeDeps(overrides: Partial<SeasonDateServiceDeps> = {}): SeasonDateServiceDeps {
  return {
    findSeasonByName: vi.fn().mockResolvedValue(ok(makeSeason())),
    findCompetitionsByName: vi.fn().mockResolvedValue(ok([makeCompetition()])),
    setCompetitionSeasonDates: vi.fn().mockResolvedValue(
      ok({
        id: "cse_written000",
        competitionId: "cmp_npl0000000",
        seasonId: "sea_2026000000",
        startsOn: makeIsoDate("2026-03-01"),
        endsOn: makeIsoDate("2026-09-30"),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
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
  it("writes the window to the competition's season", async () => {
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
    expect(deps.setCompetitionSeasonDates).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: "cmp_npl0000000",
        seasonId: "sea_2026000000",
        startsOn: "2026-03-01",
        endsOn: "2026-09-30",
      }),
    );
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

  it("reports a missing competition", async () => {
    const deps = makeDeps({ findCompetitionsByName: vi.fn().mockResolvedValue(ok([])) });

    const result = await setSeasonDates(deps, { ...validInput, competitionName: "Typo Cup" });

    expect(result).toEqual(ok({ status: "missing-competition" }));
  });

  it("reports an ambiguous competition name with the match count", async () => {
    const deps = makeDeps({
      findCompetitionsByName: vi.fn().mockResolvedValue(ok([makeCompetition(), makeCompetition()])),
    });

    const result = await setSeasonDates(deps, validInput);

    expect(result).toEqual(ok({ status: "ambiguous-competition", count: 2 }));
  });

  it("propagates a write failure", async () => {
    const writeError = serverError("Failed to upsert competition season");
    const deps = makeDeps({ setCompetitionSeasonDates: vi.fn().mockResolvedValue(writeError) });

    const result = await setSeasonDates(deps, validInput);

    expect(result).toEqual(writeError);
  });
});

describe("describeSeasonDatesFailure", () => {
  it("names the missing season", () => {
    const failure = describeSeasonDatesFailure({ status: "missing-season" }, "2099", "NPL");

    expect(failure.message).toContain('No season named "2099"');
    expect(failure.hint).toContain("mday catalog");
  });

  it("names the missing competition", () => {
    const failure = describeSeasonDatesFailure(
      { status: "missing-competition" },
      "2026",
      "Typo Cup",
    );

    expect(failure.message).toContain('No competition named "Typo Cup"');
  });

  it("reports the ambiguous competition count", () => {
    const failure = describeSeasonDatesFailure(
      { status: "ambiguous-competition", count: 2 },
      "2026",
      "NPL",
    );

    expect(failure.message).toContain("(2 matched)");
  });
});
