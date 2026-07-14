import { competitionSchema } from "./competition.ts";

function makeValidCompetition() {
  return {
    id: "cmp_abc123",
    name: "Victorian Premier League",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("competitionSchema", () => {
  it("accepts a valid competition", () => {
    const result = competitionSchema.safeParse(makeValidCompetition());

    expect(result.success).toBe(true);
  });

  it("rejects a competition missing a name", () => {
    const { name: _name, ...withoutName } = makeValidCompetition();

    const result = competitionSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });
});
