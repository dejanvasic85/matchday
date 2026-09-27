import { roundRobinRounds, seasonRounds, type RoundPairing } from "#crawlers/coastal/roundRobin.ts";

const teamCount = 12;

function pairKey(pairing: RoundPairing): string {
  return `${pairing.homeIndex}-${pairing.awayIndex}`;
}

describe("roundRobinRounds", () => {
  const rounds = roundRobinRounds(teamCount);

  it("plays every rival once across 11 rounds", () => {
    expect(rounds).toHaveLength(11);
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
    expect(() => roundRobinRounds(11)).toThrow();
    expect(() => roundRobinRounds(1)).toThrow();
  });
});

describe("seasonRounds", () => {
  const rounds = seasonRounds(teamCount);

  it("adds two replay rounds that swap the first two", () => {
    expect(rounds).toHaveLength(13);
    const reversed = (index: number) =>
      rounds[index]?.map((pairing) => ({
        homeIndex: pairing.awayIndex,
        awayIndex: pairing.homeIndex,
      }));
    expect(rounds[11]).toEqual(reversed(0));
    expect(rounds[12]).toEqual(reversed(1));
  });
});
