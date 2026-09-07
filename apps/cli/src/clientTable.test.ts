import { renderClientTable } from "#clientTable.ts";
import type { ClientSummary } from "#services/clientService.ts";

function makeClient(overrides: Partial<ClientSummary> = {}): ClientSummary {
  return {
    id: "cli_willy00000",
    name: "Williamstown SC",
    activeTokenCount: 1,
    lastApiUseAt: new Date("2026-09-01T04:00:00.000Z"),
    clubs: [
      {
        id: "ccl_one0000000",
        clubId: "clb_abc123",
        clubName: "Williamstown SC",
        hasWebhook: false,
      },
    ],
    subscriptions: [
      {
        id: "sub_one0000000",
        leagueId: "lea_abc123",
        leagueName: "Div 1 North",
        seasonName: "2026",
      },
    ],
    ...overrides,
  };
}

describe("renderClientTable", () => {
  it("prompts the operator to add one when there are no clients", () => {
    expect(renderClientTable([])).toContain("mday client add");
  });

  it("renders a client's id, name, token count and followed club on one line", () => {
    const output = renderClientTable([makeClient()]);
    const [, row] = output.split("\n");

    expect(row).toContain("cli_willy00000");
    expect(row).toContain("Williamstown SC");
    expect(row).toContain("2026: 1");
  });

  it("counts subscriptions per season so a leftover season stands out", () => {
    const output = renderClientTable([
      makeClient({
        subscriptions: [
          { id: "sub_one", leagueId: "lea_a", leagueName: "Div 1", seasonName: "2026" },
          { id: "sub_two", leagueId: "lea_b", leagueName: "Div 2", seasonName: "2026" },
          { id: "sub_old", leagueId: "lea_c", leagueName: "Div 3", seasonName: "2025" },
        ],
      }),
    ]);

    expect(output).toContain("2025: 1, 2026: 2");
  });

  it("puts each extra followed club on its own line", () => {
    const output = renderClientTable([
      makeClient({
        clubs: [
          {
            id: "ccl_one0000000",
            clubId: "clb_abc123",
            clubName: "Williamstown SC",
            hasWebhook: false,
          },
          { id: "ccl_two0000000", clubId: "clb_def456", clubName: "Altona FC", hasWebhook: false },
        ],
      }),
    ]);

    expect(output.split("\n")).toHaveLength(3);
    expect(output).toContain("Altona FC");
  });

  it("renders a placeholder for a client that follows no clubs", () => {
    const output = renderClientTable([
      makeClient({ clubs: [], subscriptions: [], activeTokenCount: 0 }),
    ]);

    expect(output.split("\n")).toHaveLength(2);
    expect(output).not.toContain("ccl_");
  });

  it("marks a followed club with a configured webhook, and one without", () => {
    const output = renderClientTable([
      makeClient({
        clubs: [
          {
            id: "ccl_one0000000",
            clubId: "clb_abc123",
            clubName: "Williamstown SC",
            hasWebhook: true,
          },
          { id: "ccl_two0000000", clubId: "clb_def456", clubName: "Altona FC", hasWebhook: false },
        ],
      }),
    ]);
    const [, withWebhook, withoutWebhook] = output.split("\n");

    expect(withWebhook).toContain("yes");
    expect(withoutWebhook).not.toContain("yes");
  });

  it("dates the client's last API call, without a misleading time of day", () => {
    const output = renderClientTable([makeClient()]);
    const [, row] = output.split("\n");

    expect(row).toContain("2026-09-01");
    expect(row).not.toContain("04:00");
  });

  it("says so plainly when a client has never called the API", () => {
    const output = renderClientTable([makeClient({ lastApiUseAt: null })]);
    const [, row] = output.split("\n");

    expect(row).toContain("never");
  });

  it("aligns columns across clients of differing name lengths", () => {
    const output = renderClientTable([
      makeClient({ name: "A" }),
      makeClient({ id: "cli_altona0000", name: "A Much Longer Club Name", clubs: [] }),
    ]);
    const lines = output.split("\n");

    const idColumnStarts = lines.map((line) => line.indexOf("cli_")).filter((index) => index >= 0);
    expect(new Set(idColumnStarts).size).toBe(1);
  });
});
