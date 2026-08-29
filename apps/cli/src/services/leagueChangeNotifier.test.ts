import type { schema } from "@matchday/db";
import { ok, serverError } from "@matchday/domain";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import {
  withLeagueChangeNotification,
  type LeagueWebhookNotifierDeps,
} from "#services/leagueChangeNotifier.ts";

type FixtureRow = typeof schema.fixture.$inferSelect;

const epoch = new Date("2026-01-01T00:00:00.000Z");
const crawledAt = new Date("2026-08-12T09:00:00.000Z");
const clubId = "clb_abc123";
const clientId = "cli_abc123";
const clientClubWebhook = {
  id: "ccl_abc123",
  clientId,
  clientName: "Williamstown SC",
  clubId,
  webhookUrl: "https://example.com/webhooks/matchday",
  webhookSecret: "whsec_test",
};
const subscriptionRow = {
  id: "sub_abc123",
  clientId,
  leagueId: "lea_abc123",
  leagueName: "Div 1 North",
  seasonId: "sea_abc123",
  seasonName: "2026",
};

function makeFixtureRow(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: "mtc_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    round: 1,
    homeTeamId: "tea_home0001",
    awayTeamId: "tea_away0001",
    venue: "Home Ground",
    latitude: null,
    longitude: null,
    kickoffAt: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    isBye: false,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<LeagueWebhookNotifierDeps> = {}): LeagueWebhookNotifierDeps {
  return {
    listClubIdsByLeagueId: vi.fn().mockResolvedValue(ok([clubId])),
    listClientClubWebhooksForClubIds: vi.fn().mockResolvedValue(ok([clientClubWebhook])),
    listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([subscriptionRow])),
    listFixturesByLeagueId: vi.fn().mockResolvedValue(ok([makeFixtureRow()])),
    listTableEntriesByLeagueId: vi.fn().mockResolvedValue(ok([])),
    sendWebhook: vi.fn().mockResolvedValue(ok(undefined)),
    logger: makeFakeLogger(),
    now: () => crawledAt,
    ...overrides,
  };
}

describe("withLeagueChangeNotification", () => {
  it("runs the crawl without any lookups on a dry run", async () => {
    const deps = makeDeps();
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    const result = await withLeagueChangeNotification(
      deps,
      { leagueId: "lea_abc123", dryRun: true },
      runCrawl,
    );

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 0 }));
    expect(runCrawl).toHaveBeenCalledTimes(1);
    expect(deps.listClubIdsByLeagueId).not.toHaveBeenCalled();
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("runs the crawl without snapshotting when no followed club has a webhook", async () => {
    const deps = makeDeps({
      listClientClubWebhooksForClubIds: vi.fn().mockResolvedValue(ok([])),
    });
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    const result = await withLeagueChangeNotification(
      deps,
      { leagueId: "lea_abc123", dryRun: false },
      runCrawl,
    );

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 0 }));
    expect(deps.listFixturesByLeagueId).not.toHaveBeenCalled();
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("skips a followed club's webhook when the client isn't subscribed to the league", async () => {
    const deps = makeDeps({ listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([])) });
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    await withLeagueChangeNotification(deps, { leagueId: "lea_abc123", dryRun: false }, runCrawl);

    expect(deps.listFixturesByLeagueId).not.toHaveBeenCalled();
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("scopes the subscription check to the crawled league in SQL", async () => {
    const deps = makeDeps();
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    await withLeagueChangeNotification(deps, { leagueId: "lea_abc123", dryRun: false }, runCrawl);

    expect(deps.listSubscriptionsWithLeague).toHaveBeenCalledWith({ leagueId: "lea_abc123" });
  });

  it("passes a failed crawl through without notifying anyone", async () => {
    const deps = makeDeps();
    const crawlError = serverError("Failed to crawl league");
    const runCrawl = vi.fn().mockResolvedValue(crawlError);

    const result = await withLeagueChangeNotification(
      deps,
      { leagueId: "lea_abc123", dryRun: false },
      runCrawl,
    );

    expect(result).toEqual(crawlError);
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("notifies with hasChanges:false when the before/after snapshots are identical", async () => {
    const deps = makeDeps();
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    await withLeagueChangeNotification(deps, { leagueId: "lea_abc123", dryRun: false }, runCrawl);

    expect(deps.sendWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        url: clientClubWebhook.webhookUrl,
        body: JSON.stringify({
          leagueId: "lea_abc123",
          hasChanges: false,
          crawledAt: crawledAt.toISOString(),
        }),
      }),
    );
  });

  it("notifies with hasChanges:true when a fixture changed between snapshots", async () => {
    const deps = makeDeps({
      listFixturesByLeagueId: vi
        .fn()
        .mockResolvedValueOnce(ok([makeFixtureRow()]))
        .mockResolvedValueOnce(
          ok([makeFixtureRow({ status: "completed", homeScore: 2, awayScore: 1 })]),
        ),
    });
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    await withLeagueChangeNotification(deps, { leagueId: "lea_abc123", dryRun: false }, runCrawl);

    expect(deps.sendWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({
          leagueId: "lea_abc123",
          hasChanges: true,
          crawledAt: crawledAt.toISOString(),
        }),
      }),
    );
  });

  it("takes the before snapshot ahead of the crawl call, not after", async () => {
    const deps = makeDeps();
    const callOrder: string[] = [];
    vi.mocked(deps.listFixturesByLeagueId).mockImplementation(async () => {
      callOrder.push("snapshot");
      return ok([makeFixtureRow()]);
    });
    const runCrawl = vi.fn().mockImplementation(async () => {
      callOrder.push("crawl");
      return ok({ fixtures: 1, tableEntries: 0 });
    });

    await withLeagueChangeNotification(deps, { leagueId: "lea_abc123", dryRun: false }, runCrawl);

    expect(callOrder).toEqual(["snapshot", "crawl", "snapshot"]);
  });

  it("skips notification when the webhook lookup fails, but still runs the crawl", async () => {
    const lookupError = serverError("Failed to list client club webhooks for club ids");
    const deps = makeDeps({
      listClientClubWebhooksForClubIds: vi.fn().mockResolvedValue(lookupError),
    });
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    const result = await withLeagueChangeNotification(
      deps,
      { leagueId: "lea_abc123", dryRun: false },
      runCrawl,
    );

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 0 }));
    expect(runCrawl).toHaveBeenCalledTimes(1);
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("skips notification when the before snapshot fails, but still returns the crawl result", async () => {
    const snapshotError = serverError("Failed to list fixtures by league id");
    const deps = makeDeps({ listFixturesByLeagueId: vi.fn().mockResolvedValue(snapshotError) });
    const runCrawl = vi.fn().mockResolvedValue(ok({ fixtures: 1, tableEntries: 0 }));

    const result = await withLeagueChangeNotification(
      deps,
      { leagueId: "lea_abc123", dryRun: false },
      runCrawl,
    );

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 0 }));
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });
});
