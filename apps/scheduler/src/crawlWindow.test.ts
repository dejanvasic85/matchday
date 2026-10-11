import {
  coastalLeagueMinIntervalMs,
  isInCatalogWindow,
  isInCoastalCatalogWindow,
  isInCoastalGameWindow,
  isInCoastalLeagueWindow,
  isInLeagueWindow,
  leagueMinIntervalMs,
} from "#crawlWindow.ts";

// Melbourne is UTC+10 (AEST) in winter and UTC+11 (AEDT) from the first Sunday in October.
// These fixtures deliberately straddle that switch — a UTC-only cron cannot get both right.
describe("isInLeagueWindow", () => {
  it("crawls during a weekday evening in AEST", () => {
    // 2026-08-31 09:00Z = Mon 19:00 Melbourne (AEST, UTC+10).
    const decision = isInLeagueWindow(new Date("2026-08-31T09:00:00Z"));

    expect(decision).toEqual({ inWindow: true, localHour: 19, localWeekday: "Mon" });
  });

  it("skips a weekday morning", () => {
    // 2026-08-31 00:00Z = Mon 10:00 Melbourne.
    const decision = isInLeagueWindow(new Date("2026-08-31T00:00:00Z"));

    expect(decision.inWindow).toBe(false);
    expect(decision.localHour).toBe(10);
  });

  it("crawls from late morning on a Saturday, when weekday hours would not", () => {
    // 2026-08-29 01:00Z = Sat 11:00 Melbourne — inside the weekend window, outside the weekday one.
    const decision = isInLeagueWindow(new Date("2026-08-29T01:00:00Z"));

    expect(decision).toEqual({ inWindow: true, localHour: 11, localWeekday: "Sat" });
  });

  it("skips a Sunday morning before the weekend window opens", () => {
    // 2026-08-30 00:00Z = Sun 10:00 Melbourne.
    const decision = isInLeagueWindow(new Date("2026-08-30T00:00:00Z"));

    expect(decision.inWindow).toBe(false);
    expect(decision.localWeekday).toBe("Sun");
  });

  it("still crawls the 7pm weekday slot after the AEDT switch", () => {
    // 2026-11-02 08:00Z = Mon 19:00 Melbourne (AEDT, UTC+11). The same local hour as the AEST
    // case above, an hour earlier in UTC — which is exactly what a fixed cron gets wrong.
    const decision = isInLeagueWindow(new Date("2026-11-02T08:00:00Z"));

    expect(decision).toEqual({ inWindow: true, localHour: 19, localWeekday: "Mon" });
  });

  it("does not crawl at 5pm local, on either side of the daylight-saving switch", () => {
    // 2026-08-31 07:00Z and 2026-11-02 06:00Z are both Mon 17:00 Melbourne.
    expect(isInLeagueWindow(new Date("2026-08-31T07:00:00Z")).inWindow).toBe(false);
    expect(isInLeagueWindow(new Date("2026-11-02T06:00:00Z")).inWindow).toBe(false);
  });

  it("includes both ends of the window", () => {
    // Mon 18:00 and Mon 23:00 Melbourne (AEST).
    expect(isInLeagueWindow(new Date("2026-08-31T08:00:00Z")).inWindow).toBe(true);
    expect(isInLeagueWindow(new Date("2026-08-31T13:00:00Z")).inWindow).toBe(true);
  });

  it("stops at midnight local", () => {
    // 2026-08-31 14:00Z = Tue 00:00 Melbourne.
    const decision = isInLeagueWindow(new Date("2026-08-31T14:00:00Z"));

    expect(decision.inWindow).toBe(false);
    expect(decision.localHour).toBe(0);
  });
});

describe("leagueMinIntervalMs", () => {
  it("runs every 55 minutes on a weekday evening", () => {
    // Mon 19:00 Melbourne (AEST).
    expect(leagueMinIntervalMs(new Date("2026-08-31T09:00:00Z"))).toBe(55 * 60_000);
  });

  it("backs off to two hours on a Saturday", () => {
    // Sat 11:00 Melbourne (AEST).
    expect(leagueMinIntervalMs(new Date("2026-08-29T01:00:00Z"))).toBe(2 * 60 * 60_000);
  });

  it("backs off to two hours on a Sunday, either side of the daylight-saving switch", () => {
    // Sun 14:00 Melbourne, in AEST and then in AEDT.
    expect(leagueMinIntervalMs(new Date("2026-08-30T04:00:00Z"))).toBe(2 * 60 * 60_000);
    expect(leagueMinIntervalMs(new Date("2026-11-08T03:00:00Z"))).toBe(2 * 60 * 60_000);
  });
});

describe("isInCatalogWindow", () => {
  it("opens on the weekly Tuesday morning slot in AEST", () => {
    // 2026-08-31 17:00Z = Tue 03:00 Melbourne (AEST, UTC+10).
    const decision = isInCatalogWindow(new Date("2026-08-31T17:00:00Z"));

    expect(decision).toEqual({ inWindow: true, localHour: 3, localWeekday: "Tue" });
  });

  it("holds the slot after the AEDT switch, where a fixed UTC cron would drift an hour", () => {
    // 2026-11-09 16:00Z = Tue 03:00 Melbourne (AEDT, UTC+11).
    const decision = isInCatalogWindow(new Date("2026-11-09T16:00:00Z"));

    expect(decision).toEqual({ inWindow: true, localHour: 3, localWeekday: "Tue" });
  });

  it("includes both ends of the slot, so a dropped tick still lands inside it", () => {
    // Tue 02:00 and Tue 06:00 Melbourne.
    expect(isInCatalogWindow(new Date("2026-08-31T16:00:00Z")).inWindow).toBe(true);
    expect(isInCatalogWindow(new Date("2026-08-31T20:00:00Z")).inWindow).toBe(true);
  });

  it("closes either side of the slot", () => {
    // Tue 01:00 and Tue 07:00 Melbourne.
    expect(isInCatalogWindow(new Date("2026-08-31T15:00:00Z")).inWindow).toBe(false);
    expect(isInCatalogWindow(new Date("2026-08-31T21:00:00Z")).inWindow).toBe(false);
  });

  it("stays shut on every other day of the week", () => {
    // 2026-09-01 17:00Z = Wed 03:00 Melbourne.
    const decision = isInCatalogWindow(new Date("2026-09-01T17:00:00Z"));

    expect(decision).toEqual({ inWindow: false, localHour: 3, localWeekday: "Wed" });
  });

  it("does not open during a game window, unlike the league crawl", () => {
    // Mon 19:00 Melbourne — inside the league window, nowhere near the catalog slot.
    const instant = new Date("2026-08-31T09:00:00Z");

    expect(isInLeagueWindow(instant).inWindow).toBe(true);
    expect(isInCatalogWindow(instant).inWindow).toBe(false);
  });
});

// 2026-08-28 is a Friday: Fri 18:00 Melbourne (AEST, UTC+10) is 08:00Z.
describe("isInCoastalGameWindow", () => {
  it("opens at Friday evening", () => {
    expect(isInCoastalGameWindow(new Date("2026-08-28T08:00:00Z"))).toEqual({
      inWindow: true,
      localHour: 18,
      localWeekday: "Fri",
    });
  });

  it("stays shut on Friday afternoon", () => {
    expect(isInCoastalGameWindow(new Date("2026-08-28T07:00:00Z")).inWindow).toBe(false);
  });

  it("covers all of Saturday and Sunday", () => {
    // Sat 12:00 and Sun 14:00 Melbourne.
    expect(isInCoastalGameWindow(new Date("2026-08-29T02:00:00Z")).inWindow).toBe(true);
    expect(isInCoastalGameWindow(new Date("2026-08-30T04:00:00Z")).inWindow).toBe(true);
  });

  it("closes at Sunday 23:00 local", () => {
    // Sun 23:00 is in, Mon 00:00 is out.
    expect(isInCoastalGameWindow(new Date("2026-08-30T13:00:00Z")).inWindow).toBe(true);
    expect(isInCoastalGameWindow(new Date("2026-08-30T14:00:00Z")).inWindow).toBe(false);
  });

  it("is shut midweek", () => {
    // Thu 20:00 Melbourne.
    expect(isInCoastalGameWindow(new Date("2026-08-27T10:00:00Z")).inWindow).toBe(false);
  });
});

describe("coastalLeagueMinIntervalMs", () => {
  it("crawls every 15 minutes over a game weekend", () => {
    expect(coastalLeagueMinIntervalMs(new Date("2026-08-28T08:00:00Z"))).toBe(15 * 60_000);
  });

  it("backs off to hourly midweek", () => {
    expect(coastalLeagueMinIntervalMs(new Date("2026-08-27T10:00:00Z"))).toBe(60 * 60_000);
  });
});

describe("isInCoastalLeagueWindow", () => {
  it("is eligible on every tick, even midweek", () => {
    // Thu 20:00 Melbourne — outside the game window, still eligible for the hourly crawl.
    expect(isInCoastalLeagueWindow(new Date("2026-08-27T10:00:00Z"))).toEqual({
      inWindow: true,
      localHour: 20,
      localWeekday: "Thu",
    });
  });
});

describe("isInCoastalCatalogWindow", () => {
  it("opens at 03:00 local every day", () => {
    // Tue 03:00 and Wed 03:00 Melbourne.
    expect(isInCoastalCatalogWindow(new Date("2026-08-31T17:00:00Z"))).toEqual({
      inWindow: true,
      localHour: 3,
      localWeekday: "Tue",
    });
    expect(isInCoastalCatalogWindow(new Date("2026-09-01T17:00:00Z")).inWindow).toBe(true);
  });

  it("closes outside the daily slot", () => {
    // Tue 01:00 Melbourne.
    expect(isInCoastalCatalogWindow(new Date("2026-08-31T15:00:00Z")).inWindow).toBe(false);
  });
});
