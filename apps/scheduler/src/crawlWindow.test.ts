import { decideCrawl } from "#crawlWindow.ts";

// Melbourne is UTC+10 (AEST) in winter and UTC+11 (AEDT) from the first Sunday in October.
// These fixtures deliberately straddle that switch — a UTC-only cron cannot get both right.
describe("decideCrawl", () => {
  it("crawls during a weekday evening in AEST", () => {
    // 2026-08-31 09:00Z = Mon 19:00 Melbourne (AEST, UTC+10).
    const decision = decideCrawl(new Date("2026-08-31T09:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 19, localWeekday: "Mon" });
  });

  it("skips a weekday morning", () => {
    // 2026-08-31 00:00Z = Mon 10:00 Melbourne.
    const decision = decideCrawl(new Date("2026-08-31T00:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localHour).toBe(10);
  });

  it("crawls from late morning on a Saturday, when weekday hours would not", () => {
    // 2026-08-29 01:00Z = Sat 11:00 Melbourne — inside the weekend window, outside the weekday one.
    const decision = decideCrawl(new Date("2026-08-29T01:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 11, localWeekday: "Sat" });
  });

  it("skips a Sunday morning before the weekend window opens", () => {
    // 2026-08-30 00:00Z = Sun 10:00 Melbourne.
    const decision = decideCrawl(new Date("2026-08-30T00:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localWeekday).toBe("Sun");
  });

  it("still crawls the 7pm weekday slot after the AEDT switch", () => {
    // 2026-11-02 08:00Z = Mon 19:00 Melbourne (AEDT, UTC+11). The same local hour as the AEST
    // case above, an hour earlier in UTC — which is exactly what a fixed cron gets wrong.
    const decision = decideCrawl(new Date("2026-11-02T08:00:00Z"));

    expect(decision).toEqual({ shouldCrawl: true, localHour: 19, localWeekday: "Mon" });
  });

  it("does not crawl at 5pm local, on either side of the daylight-saving switch", () => {
    // 2026-08-31 07:00Z and 2026-11-02 06:00Z are both Mon 17:00 Melbourne.
    expect(decideCrawl(new Date("2026-08-31T07:00:00Z")).shouldCrawl).toBe(false);
    expect(decideCrawl(new Date("2026-11-02T06:00:00Z")).shouldCrawl).toBe(false);
  });

  it("includes both ends of the window", () => {
    // Mon 18:00 and Mon 23:00 Melbourne (AEST).
    expect(decideCrawl(new Date("2026-08-31T08:00:00Z")).shouldCrawl).toBe(true);
    expect(decideCrawl(new Date("2026-08-31T13:00:00Z")).shouldCrawl).toBe(true);
  });

  it("stops at midnight local", () => {
    // 2026-08-31 14:00Z = Tue 00:00 Melbourne.
    const decision = decideCrawl(new Date("2026-08-31T14:00:00Z"));

    expect(decision.shouldCrawl).toBe(false);
    expect(decision.localHour).toBe(0);
  });
});
