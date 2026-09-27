import { seasonRoundCountValue } from "#crawlers/coastal/constants.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import {
  roundRobinRounds,
  seasonRoundCount,
  seasonRounds,
  type RoundPairing,
} from "#crawlers/coastal/roundRobin.ts";

const teamCount = coastalClubs.length;

function pairKey(pairing: RoundPairing): string {
  return `${pairing.homeIndex}-${pairing.awayIndex}`;
}

describe("roundRobinRounds", () => {
  const rounds = roundRobinRounds(teamCount);

  it("plays every rival once across 19 rounds", () => {
    expect(rounds).toHaveLength(19);
    const meetings = new Set(rounds.flat().map(pairKey));
    expect(meetings.size).toBe((teamCount * (teamCount - 1)) / 2);
  });

  it("never lets a team play twice in a round", () => {
    for (const round of rounds) {
      const teams = round.flatMap((pairing) => [pairing.homeIndex, pairing.awayIndex]);
      expect(new Set(teams).size).toBe(teamCount);
    }
  });

  it("is deterministic", () => {
    expect(roundRobinRounds(teamCount)).toEqual(rounds);
  });

  it("rejects an odd or too-small team count", () => {
    expect(() => roundRobinRounds(19)).toThrow();
    expect(() => roundRobinRounds(1)).toThrow();
  });
});

describe("seasonRoundCount", () => {
  it("is two matches against each rival, matching the season constant", () => {
    expect(seasonRoundCount(teamCount)).toBe(seasonRoundCountValue);
  });
});

describe("seasonRounds", () => {
  const rounds = seasonRounds(teamCount);

  it("doubles the round-robin to 38 rounds", () => {
    expect(rounds).toHaveLength(38);
  });

  it("swaps venues for the second half of the season", () => {
    expect(rounds[19]).toEqual(
      rounds[0]?.map((pairing) => ({
        homeIndex: pairing.awayIndex,
        awayIndex: pairing.homeIndex,
      })),
    );
  });

  it("gives every club one home match against each rival", () => {
    const homeCounts = new Map<string, number>();
    for (const pairing of rounds.flat()) {
      const key = [pairing.homeIndex, pairing.awayIndex].sort((a, b) => a - b).join("-");
      homeCounts.set(key, (homeCounts.get(key) ?? 0) + 1);
    }
    expect(homeCounts.size).toBe((teamCount * (teamCount - 1)) / 2);
    for (const count of homeCounts.values()) {
      expect(count).toBe(2);
    }
  });
});
