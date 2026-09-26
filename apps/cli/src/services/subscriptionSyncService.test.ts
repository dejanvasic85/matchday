import { ok, serverError } from "@matchday/domain";
import { syncSubscriptions, type SubscriptionSyncDeps } from "#services/subscriptionSyncService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import { makeLeagueWithRefs } from "#test/fixtures/league.ts";

function makeDeps(overrides: Partial<SubscriptionSyncDeps> = {}): SubscriptionSyncDeps {
  return {
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    findLatestSeason: vi.fn().mockResolvedValue(
      ok({
        id: "sea_2026000000",
        name: "2026",
        startsOn: makeIsoDate("2026-02-12"),
        endsOn: makeIsoDate("2026-09-20"),
      }),
    ),
    findSeasonByName: vi.fn().mockResolvedValue(
      ok({
        id: "sea_2026000000",
        name: "2026",
        startsOn: makeIsoDate("2026-02-12"),
        endsOn: makeIsoDate("2026-09-20"),
      }),
    ),
    listClientClubsByClientId: vi.fn().mockResolvedValue(
      ok([
        {
          id: "ccl_one0000000",
          clientId: "cli_existing000",
          clubId: "clb_willy00000",
          clubName: "Williamstown SC",
          webhookUrl: null,
        },
      ]),
    ),
    listLeaguesByClubId: vi
      .fn()
      .mockResolvedValue(
        ok([
          makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" }),
          makeLeagueWithRefs({ id: "lea_div2south", name: "Div 2 South" }),
        ]),
      ),
    listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([])),
    upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated0" })),
    deleteSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_removed000" })),
    ...overrides,
  };
}

/** Today, pinned so a test's "finished" outcome never depends on the wall clock. */
const today = makeIsoDate("2026-08-01");

const currentSubscription = {
  id: "sub_current000",
  clientId: "cli_existing000",
  leagueId: "lea_div1north",
  leagueName: "Div 1 North",
  seasonId: "sea_2026000000",
  seasonName: "2026",
  seasonEndsOn: makeIsoDate("2026-09-30"),
};

/** A subscription whose season ended before `today`, so the sync prunes it. */
const finishedSubscription = {
  id: "sub_stale00000",
  clientId: "cli_existing000",
  leagueId: "lea_old2025000",
  leagueName: "Div 1 North",
  seasonId: "sea_2025000000",
  seasonName: "2025",
  seasonEndsOn: makeIsoDate("2025-09-30"),
};

describe("syncSubscriptions", () => {
  it("plans an addition for every unsubscribed league a followed club plays in", async () => {
    const deps = makeDeps();

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions).toEqual([
        { leagueId: "lea_div1north", leagueName: "Div 1 North", clubName: "Williamstown SC" },
        { leagueId: "lea_div2south", leagueName: "Div 2 South", clubName: "Williamstown SC" },
      ]);
      expect(result.value.applied).toBe(false);
    }
  });

  it("writes nothing unless apply is set", async () => {
    const deps = makeDeps();

    await syncSubscriptions({ deps, clientName: "Williamstown SC", apply: false });

    expect(deps.upsertSubscription).not.toHaveBeenCalled();
    expect(deps.deleteSubscription).not.toHaveBeenCalled();
  });

  it("writes the additions and removals when apply is set", async () => {
    const deps = makeDeps({
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([finishedSubscription])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: true,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.applied).toBe(true);
    }
    expect(deps.upsertSubscription).toHaveBeenCalledTimes(2);
    expect(deps.deleteSubscription).toHaveBeenCalledWith("sub_stale00000");
  });

  it("removes a subscription once its season's end date is past", async () => {
    const deps = makeDeps({
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([finishedSubscription])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.removals).toEqual([
        {
          subscriptionId: "sub_stale00000",
          leagueId: "lea_old2025000",
          leagueName: "Div 1 North",
          seasonName: "2025",
        },
      ]);
    }
  });

  it("keeps a subscription whose season has no end date", async () => {
    const undated = { ...finishedSubscription, seasonEndsOn: null };
    const deps = makeDeps({
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([undated])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Its season is undated, so we can't say it ended — never prune it.
      expect(result.value.removals).toEqual([]);
    }
  });

  it("keeps a subscription whose season ends today, pruning only after it has ended", async () => {
    const endsToday = { ...currentSubscription, seasonEndsOn: today };
    const deps = makeDeps({
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([endsToday])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.removals).toEqual([]);
    }
  });

  it("keeps a hand-added subscription in the target season, even outside the followed clubs", async () => {
    const manual = {
      id: "sub_manual0000",
      clientId: "cli_existing000",
      leagueId: "lea_unrelated0",
      leagueName: "Masters Div 1",
      seasonId: "sea_2026000000",
      seasonName: "2026",
    };
    const deps = makeDeps({
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([manual])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.removals).toEqual([]);
      expect(result.value.unchangedCount).toBe(1);
    }
  });

  it("plans nothing when every followed club's league is already subscribed", async () => {
    const deps = makeDeps({
      listLeaguesByClubId: vi
        .fn()
        .mockResolvedValue(ok([makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" })])),
      listSubscriptionsWithLeague: vi.fn().mockResolvedValue(ok([currentSubscription])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions).toEqual([]);
      expect(result.value.removals).toEqual([]);
    }
  });

  it("credits a league shared by two followed clubs to one club only", async () => {
    const deps = makeDeps({
      listClientClubsByClientId: vi.fn().mockResolvedValue(
        ok([
          {
            id: "ccl_one",
            clientId: "cli_existing000",
            clubId: "clb_a",
            clubName: "Club A",
            webhookUrl: null,
          },
          {
            id: "ccl_two",
            clientId: "cli_existing000",
            clubId: "clb_b",
            clubName: "Club B",
            webhookUrl: null,
          },
        ]),
      ),
      listLeaguesByClubId: vi
        .fn()
        .mockResolvedValue(ok([makeLeagueWithRefs({ id: "lea_shared0000", name: "Div 1 North" })])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions).toEqual([
        { leagueId: "lea_shared0000", leagueName: "Div 1 North", clubName: "Club A" },
      ]);
    }
  });

  it("scopes the derivation to the seasons the followed clubs play in", async () => {
    const deps = makeDeps();

    await syncSubscriptions({ deps, clientName: "Williamstown SC", apply: false });

    // Unpinned: no season filter, so the club's own history bounds the target set.
    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_willy00000", undefined);
  });

  it("pins the derivation to one season when --season is given", async () => {
    const deps = makeDeps();

    await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      seasonName: "2026",
      apply: false,
      today,
    });

    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_willy00000", "sea_2026000000");
  });

  it("does not target another source's season for a Dribl client", async () => {
    // A Coastal season (`2026 Spring`) overlaps Dribl's `2026`, but the followed club plays only
    // in the Dribl league, so the Coastal season never appears in the target set.
    const deps = makeDeps({
      listLeaguesByClubId: vi
        .fn()
        .mockResolvedValue(ok([makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" })])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.season).toBeNull();
      expect(result.value.removals).toEqual([]);
    }
  });

  it("does not add leagues from a season that has already finished", async () => {
    // Two sources' seasons coexist; only the live one should be subscribed to. Re-adding the
    // finished season's league would undo the removal in the same run.
    const live = makeLeagueWithRefs({ id: "lea_div1north", name: "Div 1 North" });
    const finished = makeLeagueWithRefs({
      id: "lea_finished000",
      name: "Div 1 North (2025)",
      season: { ...live.season, endsOn: makeIsoDate("2025-09-30") },
    });
    const deps = makeDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(ok([live, finished])),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: false,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions.map((addition) => addition.leagueId)).toEqual([
        "lea_div1north",
      ]);
    }
  });

  it("plans an empty diff for a client that follows no clubs", async () => {
    const deps = makeDeps({ listClientClubsByClientId: vi.fn().mockResolvedValue(ok([])) });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: true,
      today,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions).toEqual([]);
      expect(result.value.clubs).toEqual([]);
    }
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("errors without writing when the client is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await syncSubscriptions({
      deps,
      clientName: "Typo FC",
      apply: true,
      today,
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("errors without writing when the named season hasn't been crawled", async () => {
    const deps = makeDeps({ findSeasonByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      seasonName: "2027",
      apply: true,
      today,
    });

    expect(result.ok).toBe(false);
    expect(deps.listClientClubsByClientId).not.toHaveBeenCalled();
  });

  it("rejects a pin on a season that has already finished", async () => {
    // Pinning a finished season would re-add leagues the next unpinned run prunes — fail fast.
    const deps = makeDeps();

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      seasonName: "2026",
      apply: false,
      today: makeIsoDate("2026-10-01"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("finished on 2026-09-20");
    }
    expect(deps.listClientClubsByClientId).not.toHaveBeenCalled();
  });

  it("stops at the first upsert failure instead of writing the rest", async () => {
    const upsertError = serverError("Failed to upsert subscription");
    const deps = makeDeps({
      upsertSubscription: vi
        .fn()
        .mockResolvedValueOnce(ok({ id: "sub_generated0" }))
        .mockResolvedValueOnce(upsertError),
    });

    const result = await syncSubscriptions({
      deps,
      clientName: "Williamstown SC",
      apply: true,
      today,
    });

    expect(result).toEqual(upsertError);
    expect(deps.deleteSubscription).not.toHaveBeenCalled();
  });
});
