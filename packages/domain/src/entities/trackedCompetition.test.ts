import { trackedCompetitionSchema } from "./trackedCompetition.ts";

function makeValidTrackedCompetition() {
  return {
    id: "trk_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("trackedCompetitionSchema", () => {
  it("accepts a valid tracked competition", () => {
    const result = trackedCompetitionSchema.safeParse(makeValidTrackedCompetition());

    expect(result.success).toBe(true);
  });

  it("rejects a tracked competition missing enabled", () => {
    const { enabled: _enabled, ...withoutEnabled } = makeValidTrackedCompetition();

    const result = trackedCompetitionSchema.safeParse(withoutEnabled);

    expect(result.success).toBe(false);
  });
});
