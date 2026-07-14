import { teamSchema } from "./team.ts";

function makeValidTeam() {
  return {
    id: "tea_abc123",
    clubId: "clb_abc123",
    name: "Williamstown SC U18",
    ageGroup: "U18",
    gender: "male",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("teamSchema", () => {
  it("accepts a fully-populated team", () => {
    const result = teamSchema.safeParse(makeValidTeam());

    expect(result.success).toBe(true);
  });

  it("accepts nullable ageGroup and gender", () => {
    const result = teamSchema.safeParse({ ...makeValidTeam(), ageGroup: null, gender: null });

    expect(result.success).toBe(true);
  });

  it("rejects a team missing clubId", () => {
    const { clubId: _clubId, ...withoutClubId } = makeValidTeam();

    const result = teamSchema.safeParse(withoutClubId);

    expect(result.success).toBe(false);
  });
});
