import { seasonSchema } from "#entities/season.ts";

function makeValidSeason() {
  return {
    id: "sea_abc123",
    source: "dribl",
    name: "2026",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("seasonSchema", () => {
  it("accepts a valid season", () => {
    const result = seasonSchema.safeParse(makeValidSeason());

    expect(result.success).toBe(true);
  });

  it("rejects a season missing a name", () => {
    const { name: _name, ...withoutName } = makeValidSeason();

    const result = seasonSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });

  it("rejects a season missing a source", () => {
    const { source: _source, ...withoutSource } = makeValidSeason();

    const result = seasonSchema.safeParse(withoutSource);

    expect(result.success).toBe(false);
  });
});
