import { ok } from "@matchday/domain";
import { listSeasonSummaries } from "#services/seasonService.ts";

describe("listSeasonSummaries", () => {
  it("keeps the calendar fields and drops the timestamp columns", async () => {
    const page = {
      rows: [
        {
          id: "sea_2026000000",
          name: "2026",
          startsOn: "2026-03-01",
          endsOn: "2026-09-30",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      ],
      nextCursor: null,
    };

    const result = listSeasonSummaries(page);

    expect(result).toEqual(
      ok({
        rows: [
          { id: "sea_2026000000", name: "2026", startsOn: "2026-03-01", endsOn: "2026-09-30" },
        ],
        nextCursor: null,
      }),
    );
  });

  it("carries null dates through for a season still missing them", () => {
    const result = listSeasonSummaries({
      rows: [{ id: "sea_2027000000", name: "2027", startsOn: null, endsOn: null }],
      nextCursor: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows[0]).toEqual({
        id: "sea_2027000000",
        name: "2027",
        startsOn: null,
        endsOn: null,
      });
    }
  });
});
