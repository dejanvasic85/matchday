import { teamSchema } from "#entities/team.ts";

function makeValidTeam() {
  return {
    id: "tea_abc123",
    clubId: "clb_abc123",
    name: "Williamstown SC U18",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("teamSchema", () => {
  it("accepts a fully-populated team", () => {
    const result = teamSchema.safeParse(makeValidTeam());

    expect(result.success).toBe(true);
  });

  it("accepts a null clubId (unlinked team)", () => {
    const result = teamSchema.safeParse({ ...makeValidTeam(), clubId: null });

    expect(result.success).toBe(true);
  });

  it("rejects a team missing clubId", () => {
    const { clubId: _clubId, ...withoutClubId } = makeValidTeam();

    const result = teamSchema.safeParse(withoutClubId);

    expect(result.success).toBe(false);
  });
});
