import { fixtureStatusValue } from "@matchday/domain";
import { matchDurationMinutes } from "#crawlers/coastal/constants.ts";
import { fixtureStateAt } from "#crawlers/coastal/fixtureState.ts";

const kickoff = new Date("2026-10-02T09:30:00.000Z");
const minutes = (count: number) => count * 60 * 1000;

function stateAt(offsetMinutes: number) {
  return fixtureStateAt(kickoff, new Date(kickoff.getTime() + minutes(offsetMinutes)), 1, 1, 42);
}

describe("fixtureStateAt", () => {
  it("is scheduled before kickoff", () => {
    expect(stateAt(-1)).toEqual({
      status: fixtureStatusValue.scheduled,
      homeScore: null,
      awayScore: null,
    });
  });

  it("is in progress from kickoff to full time", () => {
    expect(stateAt(0).status).toBe(fixtureStatusValue.inProgress);
    expect(stateAt(matchDurationMinutes - 1).status).toBe(fixtureStatusValue.inProgress);
  });

  it("is completed at full time, with a score", () => {
    const state = stateAt(matchDurationMinutes);
    expect(state.status).toBe(fixtureStatusValue.completed);
    expect(state.homeScore).not.toBeNull();
    expect(state.awayScore).not.toBeNull();
  });

  it("gives the same final score for the same seed", () => {
    expect(stateAt(matchDurationMinutes)).toEqual(stateAt(matchDurationMinutes + 60));
  });

  it("has no score until full time", () => {
    expect(stateAt(0).homeScore).toBeNull();
    expect(stateAt(0).awayScore).toBeNull();
  });
});
