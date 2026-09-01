import { decideCatalogCrawl, decideLeagueCrawl } from "#crawlWindow.ts";

// Melbourne is UTC+10 (AEST) in winter and UTC+11 (AEDT) from the first Sunday in October.
// These fixtures deliberately straddle that switch — a UTC-only cron cannot get both right.
describe("decideLeagueCrawl", () => {
  it("crawls during a weekday evening in AEST", () => {
    // 2026-08-31 09:00Z = Mon 19:00 Melbourne (AEST, UTC+10).
    const decision = decideLeagueCrawl(new Date("2026-08-31T09:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 19, localWeekday: "Mon" });
  });

  it("skips a weekday morning", () => {
    // 2026-08-31 00:00Z = Mon 10:00 Melbourne.
    const decision = decideLeagueCrawl(new Date("2026-08-31T00:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localHour).toBe(10);
  });

  it("crawls from late morning on a Saturday, when weekday hours would not", () => {
    // 2026-08-29 01:00Z = Sat 11:00 Melbourne — inside the weekend window, outside the weekday one.
    const decision = decideLeagueCrawl(new Date("2026-08-29T01:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 11, localWeekday: "Sat" });
  });

  it("skips a Sunday morning before the weekend window opens", () => {
    // 2026-08-30 00:00Z = Sun 10:00 Melbourne.
    const decision = decideLeagueCrawl(new Date("2026-08-30T00:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localWeekday).toBe("Sun");
  });

  it("still crawls the 7pm weekday slot after the AEDT switch", () => {
    // 2026-11-02 08:00Z = Mon 19:00 Melbourne (AEDT, UTC+11). The same local hour as the AEST
    // case above, an hour earlier in UTC — which is exactly what a fixed cron gets wrong.
    const decision = decideLeagueCrawl(new Date("2026-11-02T08:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 19, localWeekday: "Mon" });
  });

  it("does not crawl at 5pm local, on either side of the daylight-saving switch", () => {
    // 2026-08-31 07:00Z and 2026-11-02 06:00Z are both Mon 17:00 Melbourne.
    expect(decideLeagueCrawl(new Date("2026-08-31T07:00:00Z")).shouldCrawl).toBe(false);
    expect(decideLeagueCrawl(new Date("2026-11-02T06:00:00Z")).shouldCrawl).toBe(false);
  });

  it("includes both ends of the window", () => {
    // Mon 18:00 and Mon 23:00 Melbourne (AEST).
    expect(decideLeagueCrawl(new Date("2026-08-31T08:00:00Z")).shouldCrawl).toBe(true);
    expect(decideLeagueCrawl(new Date("2026-08-31T13:00:00Z")).shouldCrawl).toBe(true);
  });

  it("stops at midnight local", () => {
    // 2026-08-31 14:00Z = Tue 00:00 Melbourne.
    const decision = decideLeagueCrawl(new Date("2026-08-31T14:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localHour).toBe(0);
  });
});

describe("decideCatalogCrawl", () => {
  it("crawls the weekly Tuesday 3am slot in AEST", () => {
    // 2026-08-31 17:00Z = Tue 03:00 Melbourne (AEST, UTC+10).
    const decision = decideCatalogCrawl(new Date("2026-08-31T17:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 3, localWeekday: "Tue" });
  });

  it("holds the 3am slot after the AEDT switch, where a fixed UTC cron would drift to 4am", () => {
    // 2026-11-09 16:00Z = Tue 03:00 Melbourne (AEDT, UTC+11). The old `0 17 * * 1` cron would
    // have fired this run at 04:00 local instead.
    const decision = decideCatalogCrawl(new Date("2026-11-09T16:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 3, localWeekday: "Tue" });
  });

  it("skips the hours either side of the slot", () => {
    // Tue 02:00 and Tue 04:00 Melbourne.
    expect(decideCatalogCrawl(new Date("2026-08-31T16:00:00Z")).shouldCrawl).toBe(false);
    expect(decideCatalogCrawl(new Date("2026-08-31T18:00:00Z")).shouldCrawl).toBe(false);
  });

  it("skips 3am on every other day of the week", () => {
    // 2026-09-01 17:00Z = Wed 03:00 Melbourne.
    const decision = decideCatalogCrawl(new Date("2026-09-01T17:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: false, localHour: 3, localWeekday: "Wed" });
  });

  it("does not run during a game window, unlike the league crawl", () => {
    // Mon 19:00 Melbourne — inside the league window, nowhere near the catalog slot.
    const instant = new Date("2026-08-31T09:00:00Z");

    expect(decideLeagueCrawl(instant).shouldCrawl).toBe(true);
    expect(decideCatalogCrawl(instant).shouldCrawl).toBe(false);
  });
});
