import { ok } from "@matchday/domain";
import {
  backfillLeagueTeams,
  type LeagueTeamBackfillDeps,
} from "#services/leagueTeamBackfillService.ts";

function makeDeps(overrides: Partial<LeagueTeamBackfillDeps> = {}): LeagueTeamBackfillDeps {
  return {
    listTableEntryTeamPairs: vi.fn().mockResolvedValue(
      ok([
        { leagueId: "lea_div1north", teamId: "tea_existing001" },
        { leagueId: "lea_div1north", teamId: "tea_existing002" },
      ]),
    ),
    upsertLeagueTeam: vi.fn().mockResolvedValue(ok({ id: "lgt_generated0" })),
    ...overrides,
  };
}

describe("backfillLeagueTeams", () => {
  it("upserts a league_team row for every table_entry pair", async () => {
    const deps = makeDeps();

    const result = await backfillLeagueTeams(deps, false);

    expect(result).toEqual(ok({ pairs: 2, upserted: 2 }));
    expect(deps.upsertLeagueTeam).toHaveBeenCalledTimes(2);
    expect(deps.upsertLeagueTeam).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: "lea_div1north", teamId: "tea_existing001" }),
    );
    expect(deps.upsertLeagueTeam).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: "lea_div1north", teamId: "tea_existing002" }),
    );
  });

  it("counts pairs without writing on a dry run", async () => {
    const deps = makeDeps();

    const result = await backfillLeagueTeams(deps, true);

    expect(result).toEqual(ok({ pairs: 2, upserted: 0 }));
    expect(deps.upsertLeagueTeam).not.toHaveBeenCalled();
  });

  it("propagates a listTableEntryTeamPairs failure", async () => {
    const deps = makeDeps({
      listTableEntryTeamPairs: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await backfillLeagueTeams(deps, false);

    expect(result.ok).toBe(false);
    expect(deps.upsertLeagueTeam).not.toHaveBeenCalled();
  });

  it("stops at the first upsert failure, leaving earlier pairs already committed", async () => {
    const deps = makeDeps({
      upsertLeagueTeam: vi
        .fn()
        .mockResolvedValueOnce(ok({ id: "lgt_generated0" }))
        .mockResolvedValueOnce({ ok: false, error: { message: "db down" } }),
    });

    const result = await backfillLeagueTeams(deps, false);

    expect(result.ok).toBe(false);
    expect(deps.upsertLeagueTeam).toHaveBeenCalledTimes(2);
  });

  it("returns a zero summary when there are no table_entry pairs", async () => {
    const deps = makeDeps({ listTableEntryTeamPairs: vi.fn().mockResolvedValue(ok([])) });

    const result = await backfillLeagueTeams(deps, false);

    expect(result).toEqual(ok({ pairs: 0, upserted: 0 }));
    expect(deps.upsertLeagueTeam).not.toHaveBeenCalled();
  });
});
