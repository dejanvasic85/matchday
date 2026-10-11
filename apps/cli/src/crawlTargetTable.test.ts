import { renderClubCrawlTargetsResult } from "#crawlTargetTable.ts";
import type { AddClubCrawlTargetsOutcome, CrawlTargetName } from "#services/crawlTargetService.ts";

function makeName(overrides: Partial<CrawlTargetName> = {}): CrawlTargetName {
  return { competitionName: "Senol NPL Victoria Men", leagueName: "Div 1 North", ...overrides };
}

function makeOutcome(
  overrides: Partial<AddClubCrawlTargetsOutcome> = {},
): AddClubCrawlTargetsOutcome {
  return {
    club: { id: "clb_brunswick00", name: "Brunswick City SC" },
    added: [makeName()],
    alreadyTargeted: [],
    dryRun: false,
    ...overrides,
  };
}

describe("renderClubCrawlTargetsResult", () => {
  it("heads with the resolved club's name and id", () => {
    const output = renderClubCrawlTargetsResult(makeOutcome());

    expect(output.split("\n")[0]).toBe("Brunswick City SC (clb_brunswick00)");
  });

  it("summarises how many leagues were added and how many were already targeted", () => {
    const output = renderClubCrawlTargetsResult(
      makeOutcome({
        added: [makeName(), makeName({ leagueName: "Div 2 South" })],
        alreadyTargeted: [makeName({ leagueName: "Div 3 East" })],
      }),
    );

    expect(output.split("\n")[1]).toBe("Added 2 league(s); 1 already targeted.");
  });

  it("lists an added league and one already targeted with their status", () => {
    const output = renderClubCrawlTargetsResult(
      makeOutcome({
        added: [makeName()],
        alreadyTargeted: [makeName({ leagueName: "Div 3 East" })],
      }),
    );

    expect(output).toContain("added");
    expect(output).toContain("Div 1 North");
    expect(output).toContain("already targeted");
    expect(output).toContain("Div 3 East");
  });

  it("reads as a dry run when nothing was written", () => {
    const output = renderClubCrawlTargetsResult(makeOutcome({ dryRun: true }));

    expect(output.split("\n")[1]).toBe("Would add 1 league(s); 0 already targeted.");
    expect(output).toContain("would add");
  });

  it("points at the catalog crawl instead of printing an empty table", () => {
    const output = renderClubCrawlTargetsResult(makeOutcome({ added: [], alreadyTargeted: [] }));

    expect(output).toContain("No leagues found");
    expect(output).toContain("mday catalog");
  });
});
