import { renderClubLeagueTable } from "@/clubLeagueTable.ts";
import type { ClubLeagues } from "@/services/clubLeagueService.ts";

function makeClubLeagues(overrides: Partial<ClubLeagues> = {}): ClubLeagues {
  return {
    club: { id: "clb_willy00000", name: "Williamstown SC" },
    leagues: [{ id: "lea_abc123", name: "Div 1 North" }],
    ...overrides,
  };
}

describe("renderClubLeagueTable", () => {
  it("prints the resolved club's id and name as a header", () => {
    const output = renderClubLeagueTable(makeClubLeagues());

    expect(output.split("\n")[0]).toBe("Williamstown SC (clb_willy00000)");
  });

  it("renders each league's id and name on its own row", () => {
    const output = renderClubLeagueTable(
      makeClubLeagues({
        leagues: [
          { id: "lea_abc123", name: "Div 1 North" },
          { id: "lea_def456", name: "Div 2 South" },
        ],
      }),
    );
    const lines = output.split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("lea_abc123");
    expect(lines[2]).toContain("Div 1 North");
    expect(lines[3]).toContain("lea_def456");
    expect(lines[3]).toContain("Div 2 South");
  });

  it("explains the deep-crawl dependency instead of printing an empty table", () => {
    const output = renderClubLeagueTable(makeClubLeagues({ leagues: [] }));

    expect(output).toContain("deep crawl hasn't run");
  });

  it("aligns the league id column across differing name lengths", () => {
    const output = renderClubLeagueTable(
      makeClubLeagues({
        leagues: [
          { id: "lea_abc123", name: "A" },
          { id: "lea_def456", name: "A Much Longer League Name" },
        ],
      }),
    );
    const lines = output.split("\n");

    const idColumnStarts = lines.map((line) => line.indexOf("lea_")).filter((index) => index >= 0);
    expect(new Set(idColumnStarts).size).toBe(1);
  });
});
