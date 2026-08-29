import { badRequest, notFound, ok, serverError } from "@matchday/domain";
import {
  createSubscription,
  createSubscriptionsForClub,
  removeSubscription,
  type SubscriptionServiceDeps,
} from "#services/subscriptionService.ts";

function makeDeps(overrides: Partial<SubscriptionServiceDeps> = {}): SubscriptionServiceDeps {
  return {
    getLeagueById: vi.fn().mockResolvedValue(ok({ id: "lea_abc123" })),
    upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated" })),
    deleteSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_existing00" })),
    upsertClientClub: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    findLatestSeason: vi.fn().mockResolvedValue(ok({ id: "sea_2026000000", name: "2026" })),
    findSeasonByName: vi.fn().mockResolvedValue(ok({ id: "sea_2026000000", name: "2026" })),
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    findClubsByName: vi
      .fn()
      .mockResolvedValue(ok([{ id: "clb_existing000", name: "Williamstown SC" }])),
    listLeaguesByClubId: vi.fn().mockResolvedValue(
      ok([
        { id: "lea_div1north", name: "Div 1 North" },
        { id: "lea_div2south", name: "Div 2 South" },
      ]),
    ),
    ...overrides,
  };
}

describe("createSubscription", () => {
  it("returns the persisted subscription id when the league exists", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated0" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(ok("sub_generated0"));
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli_existing000", leagueId: "lea_abc123" }),
    );
  });

  it("returns the existing row's id when re-subscribing, not the freshly minted one", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_original00" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(ok("sub_original00"));
    const mintedId = vi.mocked(deps.upsertSubscription).mock.calls[0]?.[0]?.id;
    expect(mintedId).not.toEqual("sub_original00");
  });

  it("errors when the upserted subscription row id lacks the sub_ prefix", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "lea_wrong00000" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result.ok).toBe(false);
  });

  it("returns an error without upserting when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_missing",
    });

    expect(result).toEqual(notFound("League not found: lea_missing"));
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates a league lookup failure", async () => {
    const lookupError = serverError("Failed to get league by id");
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(lookupError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(lookupError);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates a client resolution failure without upserting", async () => {
    const clientError = serverError("Failed to find client by name");
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(clientError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(clientError);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates an upsert failure", async () => {
    const upsertError = serverError("Failed to upsert subscription");
    const deps = makeDeps({ upsertSubscription: vi.fn().mockResolvedValue(upsertError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(upsertError);
  });

  it("errors without subscribing when the client name is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscription({
      deps,
      clientName: "Typo FC",
      leagueId: "lea_abc123",
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });
});

describe("createSubscriptionsForClub", () => {
  it("subscribes the client to every resolved league and returns their ids", async () => {
    const deps = makeDeps({
      upsertSubscription: vi
        .fn()
        .mockResolvedValueOnce(ok({ id: "sub_generated01" }))
        .mockResolvedValueOnce(ok({ id: "sub_generated02" })),
    });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(result).toEqual(
      ok({
        club: { id: "clb_existing000", name: "Williamstown SC" },
        leagues: [
          { id: "lea_div1north", name: "Div 1 North" },
          { id: "lea_div2south", name: "Div 2 South" },
        ],
        season: { id: "sea_2026000000", name: "2026" },
        subscriptionIds: ["sub_generated01", "sub_generated02"],
      }),
    );
    expect(deps.upsertSubscription).toHaveBeenCalledTimes(2);
    expect(deps.upsertSubscription).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ clientId: "cli_existing000", leagueId: "lea_div1north" }),
    );
    expect(deps.upsertSubscription).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ clientId: "cli_existing000", leagueId: "lea_div2south" }),
    );
  });

  it("resolves the club and client but writes nothing on a dry run", async () => {
    const deps = makeDeps();

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: true,
    });

    expect(result).toEqual(
      ok({
        club: { id: "clb_existing000", name: "Williamstown SC" },
        leagues: [
          { id: "lea_div1north", name: "Div 1 North" },
          { id: "lea_div2south", name: "Div 2 South" },
        ],
        season: { id: "sea_2026000000", name: "2026" },
        subscriptionIds: [],
      }),
    );
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("returns an empty subscription list for a club with no leagues yet, not an error", async () => {
    const deps = makeDeps({ listLeaguesByClubId: vi.fn().mockResolvedValue(ok([])) });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(result).toEqual(
      ok({
        club: { id: "clb_existing000", name: "Williamstown SC" },
        leagues: [],
        season: { id: "sea_2026000000", name: "2026" },
        subscriptionIds: [],
      }),
    );
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("fails on an ambiguous club match without resolving the client or writing anything", async () => {
    const deps = makeDeps({
      findClubsByName: vi.fn().mockResolvedValue(
        ok([
          { id: "clb_williams0001", name: "Williamstown SC" },
          { id: "clb_williams0002", name: "Williamstown Juniors" },
        ]),
      ),
    });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williams",
      dryRun: false,
    });

    expect(result).toEqual(
      badRequest(
        '"Williams" matches more than one club — candidates: Williamstown SC (clb_williams0001), ' +
          "Williamstown Juniors (clb_williams0002)",
      ),
    );
    expect(deps.findClientByName).not.toHaveBeenCalled();
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("errors without writing when the club name doesn't match", async () => {
    const deps = makeDeps({ findClubsByName: vi.fn().mockResolvedValue(ok([])) });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Nonexistent FC",
      dryRun: false,
    });

    expect(result).toEqual(notFound('No club matches "Nonexistent FC"'));
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("errors without writing when the client name is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Typo FC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("scopes the club's leagues to the resolved season", async () => {
    const deps = makeDeps();

    await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_existing000", "sea_2026000000");
  });

  it("records the follow so a later sync can re-derive the same leagues", async () => {
    const deps = makeDeps();

    await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(deps.upsertClientClub).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli_existing000", clubId: "clb_existing000" }),
    );
  });

  it("records no follow on a dry run", async () => {
    const deps = makeDeps();

    await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: true,
    });

    expect(deps.upsertClientClub).not.toHaveBeenCalled();
  });

  it("errors without writing when the named season hasn't been crawled", async () => {
    const deps = makeDeps({ findSeasonByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      seasonName: "2027",
      dryRun: false,
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("stops at the first upsert failure instead of subscribing the remaining leagues", async () => {
    const upsertError = serverError("Failed to upsert subscription");
    const deps = makeDeps({
      upsertSubscription: vi
        .fn()
        .mockResolvedValueOnce(ok({ id: "sub_generated01" }))
        .mockResolvedValueOnce(upsertError),
    });

    const result = await createSubscriptionsForClub({
      deps,
      clientName: "Williamstown SC",
      clubName: "Williamstown",
      dryRun: false,
    });

    expect(result).toEqual(upsertError);
    expect(deps.upsertSubscription).toHaveBeenCalledTimes(2);
  });
});

describe("removeSubscription", () => {
  it("succeeds when the subscription exists", async () => {
    const deps = makeDeps();

    const result = await removeSubscription(deps, "sub_existing00");

    expect(result).toEqual(ok(undefined));
    expect(deps.deleteSubscription).toHaveBeenCalledWith("sub_existing00");
  });

  it("errors when the subscription id doesn't exist", async () => {
    const deps = makeDeps({ deleteSubscription: vi.fn().mockResolvedValue(ok(null)) });

    const result = await removeSubscription(deps, "sub_missing000");

    expect(result).toEqual(notFound("Subscription not found: sub_missing000"));
  });

  it("propagates a delete failure", async () => {
    const deleteError = serverError("Failed to delete subscription");
    const deps = makeDeps({ deleteSubscription: vi.fn().mockResolvedValue(deleteError) });

    const result = await removeSubscription(deps, "sub_existing00");

    expect(result).toEqual(deleteError);
  });
});
