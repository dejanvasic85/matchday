import { renderClientTable } from "./clientTable.ts";
import type { ClientSummary } from "./services/clientService.ts";

function makeClient(overrides: Partial<ClientSummary> = {}): ClientSummary {
  return {
    id: "cli_willy00000",
    name: "Williamstown SC",
    activeTokenCount: 1,
    subscriptions: [{ id: "sub_one0000000", leagueId: "lea_abc123", leagueName: "Div 1 North" }],
    ...overrides,
  };
}

describe("renderClientTable", () => {
  it("prompts the operator to add one when there are no clients", () => {
    expect(renderClientTable([])).toContain("mday client add");
  });

  it("renders a client's id, name, token count and subscription on one line", () => {
    const output = renderClientTable([makeClient()]);
    const [, row] = output.split("\n");

    expect(row).toContain("cli_willy00000");
    expect(row).toContain("Williamstown SC");
    expect(row).toContain("sub_one0000000");
    expect(row).toContain("Div 1 North");
  });

  it("puts each extra subscription on its own line so ids stay copy-pasteable", () => {
    const output = renderClientTable([
      makeClient({
        subscriptions: [
          { id: "sub_one0000000", leagueId: "lea_abc123", leagueName: "Div 1 North" },
          { id: "sub_two0000000", leagueId: "lea_def456", leagueName: "Div 2 South" },
        ],
      }),
    ]);

    expect(output.split("\n")).toHaveLength(3);
    expect(output).toContain("sub_two0000000");
  });

  it("renders a placeholder for a client with no subscriptions", () => {
    const output = renderClientTable([makeClient({ subscriptions: [], activeTokenCount: 0 })]);

    expect(output.split("\n")).toHaveLength(2);
    expect(output).not.toContain("sub_");
  });

  it("aligns columns across clients of differing name lengths", () => {
    const output = renderClientTable([
      makeClient({ name: "A" }),
      makeClient({ id: "cli_altona0000", name: "A Much Longer Club Name", subscriptions: [] }),
    ]);
    const lines = output.split("\n");

    const idColumnStarts = lines.map((line) => line.indexOf("cli_")).filter((index) => index >= 0);
    expect(new Set(idColumnStarts).size).toBe(1);
  });
});
