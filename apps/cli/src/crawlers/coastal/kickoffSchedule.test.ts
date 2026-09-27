import { melbourneWallClock } from "#crawlers/coastal/melbourneTime.ts";
import { kickoffInstant, matchesPerRound } from "#crawlers/coastal/kickoffSchedule.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";

const season = seasonWindowForYear(2026);

function wallClock(round: number, matchIndex: number) {
  return melbourneWallClock(kickoffInstant(season, round, matchIndex));
}

describe("matchesPerRound", () => {
  it("is ten", () => {
    expect(matchesPerRound).toBe(10);
  });
});

describe("kickoffInstant", () => {
  it("spreads round one across Friday, Saturday and Sunday", () => {
    expect(wallClock(1, 0)).toEqual({ date: "2026-08-21", hour: 19, minute: 30 });
    expect(wallClock(1, 1)).toEqual({ date: "2026-08-22", hour: 12, minute: 30 });
    expect(wallClock(1, 2)).toEqual({ date: "2026-08-22", hour: 15, minute: 0 });
    expect(wallClock(1, 3)).toEqual({ date: "2026-08-22", hour: 15, minute: 0 });
    expect(wallClock(1, 4)).toEqual({ date: "2026-08-22", hour: 17, minute: 30 });
    expect(wallClock(1, 5)).toEqual({ date: "2026-08-22", hour: 19, minute: 45 });
    expect(wallClock(1, 6)).toEqual({ date: "2026-08-23", hour: 14, minute: 0 });
    expect(wallClock(1, 7)).toEqual({ date: "2026-08-23", hour: 14, minute: 0 });
    expect(wallClock(1, 8)).toEqual({ date: "2026-08-23", hour: 16, minute: 30 });
    expect(wallClock(1, 9)).toEqual({ date: "2026-08-23", hour: 16, minute: 30 });
  });

  it("moves each later round on by a week", () => {
    expect(wallClock(2, 0)).toEqual({ date: "2026-08-28", hour: 19, minute: 30 });
    expect(wallClock(38, 0)).toEqual({ date: "2027-05-07", hour: 19, minute: 30 });
  });

  it("rejects a match index beyond the slots", () => {
    expect(() => kickoffInstant(season, 1, matchesPerRound)).toThrow();
  });
});
