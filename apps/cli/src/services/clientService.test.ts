import { ok, serverError } from "@matchday/domain";
import { listClientSummaries, type ClientServiceDeps } from "#services/clientService.ts";

function makeDeps(overrides: Partial<ClientServiceDeps> = {}): ClientServiceDeps {
  return {
    listClients: vi.fn().mockResolvedValue(
      ok([
        { id: "cli_willy00000", name: "Williamstown SC" },
        { id: "cli_altona0000", name: "Altona FC" },
      ]),
    ),
    listApiTokens: vi.fn().mockResolvedValue(
      ok([
        { id: "tok_active0000", clientId: "cli_willy00000", revokedAt: null },
        { id: "tok_revoked000", clientId: "cli_willy00000", revokedAt: new Date() },
      ]),
    ),
    listSubscriptionsWithLeague: vi.fn().mockResolvedValue(
      ok([
        {
          id: "sub_one0000000",
          clientId: "cli_willy00000",
          leagueId: "lea_abc123",
          leagueName: "Div 1 North",
          seasonId: "sea_abc123",
          seasonName: "2026",
        },
      ]),
    ),
    listClientClubs: vi.fn().mockResolvedValue(
      ok([
        {
          id: "ccl_one0000000",
          clientId: "cli_willy00000",
          clubId: "clb_abc123",
          clubName: "Williamstown SC",
          webhookUrl: null,
        },
      ]),
    ),
    ...overrides,
  };
}

describe("listClientSummaries", () => {
  it("attaches each client's subscriptions", async () => {
    const result = await listClientSummaries(makeDeps());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const [willy] = result.value;
      expect(willy?.subscriptions).toEqual([
        {
          id: "sub_one0000000",
          leagueId: "lea_abc123",
          leagueName: "Div 1 North",
          seasonName: "2026",
        },
      ]);
    }
  });

  it("attaches each client's followed clubs", async () => {
    const result = await listClientSummaries(makeDeps());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.clubs).toEqual([
        {
          id: "ccl_one0000000",
          clubId: "clb_abc123",
          clubName: "Williamstown SC",
          hasWebhook: false,
        },
      ]);
    }
  });

  it("reports hasWebhook true when a followed club has a webhook configured", async () => {
    const deps = makeDeps({
      listClientClubs: vi.fn().mockResolvedValue(
        ok([
          {
            id: "ccl_one0000000",
            clientId: "cli_willy00000",
            clubId: "clb_abc123",
            clubName: "Williamstown SC",
            webhookUrl: "https://example.com/webhooks/matchday",
          },
        ]),
      ),
    });

    const result = await listClientSummaries(deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.clubs[0]?.hasWebhook).toBe(true);
    }
  });

  it("counts only unrevoked tokens", async () => {
    const result = await listClientSummaries(makeDeps());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.activeTokenCount).toBe(1);
    }
  });

  it("reports zero tokens and no subscriptions for a client with neither", async () => {
    const result = await listClientSummaries(makeDeps());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const altona = result.value.find((summary) => summary.id === "cli_altona0000");
      expect(altona).toMatchObject({ activeTokenCount: 0, subscriptions: [], clubs: [] });
    }
  });

  it("returns an empty roster when there are no clients", async () => {
    const deps = makeDeps({ listClients: vi.fn().mockResolvedValue(ok([])) });

    const result = await listClientSummaries(deps);

    expect(result).toEqual(ok([]));
  });

  it("propagates a client listing failure", async () => {
    const listError = serverError("Failed to list clients");
    const deps = makeDeps({ listClients: vi.fn().mockResolvedValue(listError) });

    const result = await listClientSummaries(deps);

    expect(result).toEqual(listError);
  });

  it("propagates a subscription listing failure", async () => {
    const listError = serverError("Failed to list subscriptions with league");
    const deps = makeDeps({ listSubscriptionsWithLeague: vi.fn().mockResolvedValue(listError) });

    const result = await listClientSummaries(deps);

    expect(result).toEqual(listError);
  });

  it("propagates a followed-club listing failure", async () => {
    const listError = serverError("Failed to list client clubs");
    const deps = makeDeps({ listClientClubs: vi.fn().mockResolvedValue(listError) });

    const result = await listClientSummaries(deps);

    expect(result).toEqual(listError);
  });
});
