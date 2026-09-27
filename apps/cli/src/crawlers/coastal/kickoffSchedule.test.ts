import { melbourneWallClock } from "#crawlers/coastal/melbourneTime.ts";
import { kickoffInstant, matchesPerRound } from "#crawlers/coastal/kickoffSchedule.ts";
import { seasonWindowForIndex } from "#crawlers/coastal/seasonCalendar.ts";

const season = seasonWindowForIndex(0);

function wallClock(round: number, matchIndex: number) {
  return melbourneWallClock(kickoffInstant(season, round, matchIndex));
}

describe("matchesPerRound", () => {
  it("is six", () => {
    expect(matchesPerRound).toBe(6);
  });
});

describe("kickoffInstant", () => {
  it("spreads round one across Friday, Saturday and Sunday", () => {
    expect(wallClock(1, 0)).toEqual({ date: "2026-10-02", hour: 19, minute: 30 });
    expect(wallClock(1, 1)).toEqual({ date: "2026-10-03", hour: 13, minute: 0 });
    expect(wallClock(1, 2)).toEqual({ date: "2026-10-03", hour: 15, minute: 0 });
    expect(wallClock(1, 3)).toEqual({ date: "2026-10-03", hour: 17, minute: 0 });
    expect(wallClock(1, 4)).toEqual({ date: "2026-10-04", hour: 13, minute: 0 });
    expect(wallClock(1, 5)).toEqual({ date: "2026-10-04", hour: 15, minute: 0 });
  });

  it("moves each later round on by a week", () => {
    expect(wallClock(2, 0)).toEqual({ date: "2026-10-09", hour: 19, minute: 30 });
    expect(wallClock(13, 0)).toEqual({ date: "2026-12-25", hour: 19, minute: 30 });
  });

  it("rejects a match index beyond the slots", () => {
    expect(() => kickoffInstant(season, 1, matchesPerRound)).toThrow();
  });
});
