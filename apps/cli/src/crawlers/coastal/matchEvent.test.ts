import { createSeededRandom } from "#crawlers/coastal/random.ts";
import {
  drawMatchEvent,
  matchEventValue,
  rescheduleKickoff,
  type MatchEvent,
} from "#crawlers/coastal/matchEvent.ts";

const constantRandom = (value: number) => () => value;

describe("drawMatchEvent", () => {
  it("maps each chance band to an event", () => {
    expect(drawMatchEvent(constantRandom(0))).toBe(matchEventValue.cancelled);
    expect(drawMatchEvent(constantRandom(0.02))).toBe(matchEventValue.postponed);
    expect(drawMatchEvent(constantRandom(0.03))).toBe(matchEventValue.rescheduled);
    expect(drawMatchEvent(constantRandom(0.5))).toBe(matchEventValue.normal);
  });

  it("shows every event across many seeds", () => {
    const events = new Set<MatchEvent>();
    for (let seed = 0; seed < 500; seed += 1) {
      events.add(drawMatchEvent(createSeededRandom(seed)));
    }
    expect(events).toEqual(
      new Set([
        matchEventValue.cancelled,
        matchEventValue.postponed,
        matchEventValue.rescheduled,
        matchEventValue.normal,
      ]),
    );
  });
});

describe("rescheduleKickoff", () => {
  it("moves the match on by whole weeks", () => {
    const kickoff = new Date("2026-10-02T09:30:00.000Z");
    const moved = rescheduleKickoff(kickoff, createSeededRandom(1));
    const weeks = (moved.getTime() - kickoff.getTime()) / (7 * 24 * 60 * 60 * 1000);
    expect(Number.isInteger(weeks)).toBe(true);
    expect(weeks).toBeGreaterThanOrEqual(1);
    expect(weeks).toBeLessThanOrEqual(3);
  });

  it("keeps the same day of the week", () => {
    const kickoff = new Date("2026-10-02T09:30:00.000Z");
    expect(rescheduleKickoff(kickoff, createSeededRandom(1)).getUTCDay()).toBe(kickoff.getUTCDay());
  });

  it("is deterministic", () => {
    const kickoff = new Date("2026-10-02T09:30:00.000Z");
    expect(rescheduleKickoff(kickoff, createSeededRandom(5))).toEqual(
      rescheduleKickoff(kickoff, createSeededRandom(5)),
    );
  });
});
