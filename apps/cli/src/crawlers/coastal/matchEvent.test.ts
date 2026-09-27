import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import { melbourneInstant, melbourneWallClock } from "#crawlers/coastal/melbourneTime.ts";
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
  // A Saturday 3pm kickoff two weeks before the October daylight-saving change.
  const kickoff = melbourneInstant(makeIsoDate("2027-09-25"), 15, 0);

  it("moves the match on by one to three whole weeks", () => {
    expect(melbourneWallClock(rescheduleKickoff(kickoff, constantRandom(0)))).toEqual({
      date: "2027-10-02",
      hour: 15,
      minute: 0,
    });
    expect(melbourneWallClock(rescheduleKickoff(kickoff, constantRandom(0.34)))).toEqual({
      date: "2027-10-09",
      hour: 15,
      minute: 0,
    });
    expect(melbourneWallClock(rescheduleKickoff(kickoff, constantRandom(0.99)))).toEqual({
      date: "2027-10-16",
      hour: 15,
      minute: 0,
    });
  });

  it("keeps the Melbourne kickoff time across a daylight-saving change", () => {
    expect(melbourneWallClock(kickoff).hour).toBe(15);
    expect(melbourneWallClock(rescheduleKickoff(kickoff, constantRandom(0.99))).hour).toBe(15);
  });

  it("is deterministic", () => {
    expect(rescheduleKickoff(kickoff, createSeededRandom(5))).toEqual(
      rescheduleKickoff(kickoff, createSeededRandom(5)),
    );
  });
});
