import { forbidden, ok, serverError, type ClientId } from "@matchday/domain";
import { listLeagueTable, type TableEntryServiceDeps } from "#services/tableEntryService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");
const clientId = "cli_abc123" as ClientId;

function makeTableEntryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tab_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    teamId: "tea_abc123",
    position: 1,
    played: 10,
    won: 8,
    drawn: 1,
    lost: 1,
    goalsFor: 20,
    goalsAgainst: 5,
    goalDifference: 15,
    points: 25,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<TableEntryServiceDeps> = {}): TableEntryServiceDeps {
  return {
    hasActiveSubscription: vi.fn().mockResolvedValue(ok(true)),
    listTableEntriesByLeagueId: vi.fn().mockResolvedValue(ok([makeTableEntryRow()])),
    ...overrides,
  };
}

describe("listLeagueTable", () => {
  it("maps each entry's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listLeagueTable(deps, clientId, "lea_abc123");

    expect(result).toEqual(
      ok([expect.objectContaining({ id: "tab_abc123", createdAt: epoch.toISOString() })]),
    );
  });

  it("checks the subscription for the given client and league", async () => {
    const deps = makeDeps();

    await listLeagueTable(deps, clientId, "lea_abc123");

    expect(deps.hasActiveSubscription).toHaveBeenCalledWith(clientId, "lea_abc123");
  });

  it("returns a Forbidden failure when the client has no active subscription", async () => {
    const deps = makeDeps({ hasActiveSubscription: vi.fn().mockResolvedValue(ok(false)) });

    const result = await listLeagueTable(deps, clientId, "lea_abc123");

    expect(result).toEqual(forbidden("No active subscription to this league"));
    expect(deps.listTableEntriesByLeagueId).not.toHaveBeenCalled();
  });

  it("propagates a subscription lookup failure", async () => {
    const lookupError = serverError("Failed to check subscription");
    const deps = makeDeps({ hasActiveSubscription: vi.fn().mockResolvedValue(lookupError) });

    const result = await listLeagueTable(deps, clientId, "lea_abc123");

    expect(result).toEqual(lookupError);
  });

  it("propagates a table entry list failure", async () => {
    const listError = serverError("Failed to list table entries by league id");
    const deps = makeDeps({ listTableEntriesByLeagueId: vi.fn().mockResolvedValue(listError) });

    const result = await listLeagueTable(deps, clientId, "lea_abc123");

    expect(result).toEqual(listError);
  });
});
