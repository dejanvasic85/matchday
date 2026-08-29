import type { SubscriptionWithLeague } from "@matchday/db";
import { renderSubscriptionTable, renderSyncPlan } from "#subscriptionTable.ts";
import type { SubscriptionSyncPlan } from "#services/subscriptionSyncService.ts";

function makeSubscription(overrides: Partial<SubscriptionWithLeague> = {}): SubscriptionWithLeague {
  return {
    id: "sub_one0000000",
    clientId: "cli_willy00000",
    leagueId: "lea_abc123",
    leagueName: "Div 1 North",
    seasonId: "sea_2026000000",
    seasonName: "2026",
    ...overrides,
  };
}

function makePlan(overrides: Partial<SubscriptionSyncPlan> = {}): SubscriptionSyncPlan {
  return {
    client: "Williamstown SC",
    season: { id: "sea_2026000000", name: "2026" },
    clubs: ["Williamstown SC"],
    additions: [],
    removals: [],
    unchangedCount: 0,
    applied: false,
    ...overrides,
  };
}

describe("renderSubscriptionTable", () => {
  it("says so when there are no subscriptions", () => {
    expect(renderSubscriptionTable([])).toBe("No subscriptions.");
  });

  it("shows the season alongside the league and subscription id", () => {
    const output = renderSubscriptionTable([makeSubscription()]);

    expect(output).toContain("SEASON");
    expect(output).toContain("2026");
    expect(output).toContain("sub_one0000000");
    expect(output).toContain("Div 1 North");
  });

  it("renders one line per subscription plus a header", () => {
    const output = renderSubscriptionTable([
      makeSubscription(),
      makeSubscription({ id: "sub_two0000000", leagueName: "Div 2 South" }),
    ]);

    expect(output.split("\n")).toHaveLength(3);
  });
});

describe("renderSyncPlan", () => {
  it("labels an unapplied plan as a dry run and points at --apply", () => {
    const output = renderSyncPlan(
      makePlan({
        additions: [
          { leagueId: "lea_abc123", leagueName: "Div 1 North", clubName: "Williamstown SC" },
        ],
      }),
    );

    expect(output).toContain("Dry run");
    expect(output).toContain("--apply");
    expect(output).toContain("Div 1 North");
  });

  it("labels an applied plan as synced", () => {
    const output = renderSyncPlan(
      makePlan({
        applied: true,
        additions: [
          { leagueId: "lea_abc123", leagueName: "Div 1 North", clubName: "Williamstown SC" },
        ],
      }),
    );

    expect(output).toContain("Synced");
    expect(output).not.toContain("--apply");
  });

  it("reports an empty diff as already up to date", () => {
    const output = renderSyncPlan(makePlan({ unchangedCount: 37 }));

    expect(output).toContain("Already up to date.");
  });

  it("shows the season each removal belongs to", () => {
    const output = renderSyncPlan(
      makePlan({
        removals: [
          {
            subscriptionId: "sub_stale00000",
            leagueId: "lea_old2025000",
            leagueName: "Div 1 North",
            seasonName: "2025",
          },
        ],
      }),
    );

    expect(output).toContain("REMOVE LEAGUE");
    expect(output).toContain("2025");
    expect(output).toContain("sub_stale00000");
  });

  it("names a client that follows no clubs rather than printing an empty list", () => {
    const output = renderSyncPlan(makePlan({ clubs: [] }));

    expect(output).toContain("no followed clubs");
  });
});
