// Round-robin pairing for the Coastal league. A full round-robin gives every club one home and one
// away match against each rival; the association then replays the first two rounds with home and
// away swapped, turning 11 rounds into 13 weekly rounds.

export type RoundPairing = {
  homeIndex: number;
  awayIndex: number;
};

function at(rotation: readonly number[], index: number): number {
  const value = rotation[index];
  if (value === undefined) {
    throw new Error(`Round-robin rotation has no team at index ${index}`);
  }
  return value;
}

function rotate(rotation: number[]): void {
  const last = rotation[rotation.length - 1];
  if (last === undefined) {
    return;
  }
  rotation.splice(1, 0, last);
  rotation.pop();
}

/** The full round-robin: `teamCount - 1` rounds, each pairing every team exactly once (the circle
 * method, one team held fixed). Home and away alternate by round and position. */
export function roundRobinRounds(teamCount: number): RoundPairing[][] {
  if (teamCount < 2 || teamCount % 2 !== 0) {
    throw new Error(`Round-robin needs an even team count of at least 2, got ${teamCount}`);
  }

  const rotation = Array.from({ length: teamCount }, (_, index) => index);
  const half = teamCount / 2;
  const rounds: RoundPairing[][] = [];

  for (let round = 0; round < teamCount - 1; round += 1) {
    const pairings: RoundPairing[] = [];
    for (let position = 0; position < half; position += 1) {
      const first = at(rotation, position);
      const second = at(rotation, teamCount - 1 - position);
      const firstIsHome = (round + position) % 2 === 0;
      pairings.push(
        firstIsHome
          ? { homeIndex: first, awayIndex: second }
          : { homeIndex: second, awayIndex: first },
      );
    }
    rounds.push(pairings);
    rotate(rotation);
  }

  return rounds;
}

function swapVenue(pairing: RoundPairing): RoundPairing {
  return { homeIndex: pairing.awayIndex, awayIndex: pairing.homeIndex };
}

/** A Coastal season's rounds: the full round-robin, then rounds 1 and 2 replayed with venues
 * swapped. Cheap — the first two rounds repeat rather than a second full round-robin. */
export function seasonRounds(teamCount: number): RoundPairing[][] {
  const rounds = roundRobinRounds(teamCount);
  const first = rounds[0];
  const second = rounds[1];
  if (first === undefined || second === undefined) {
    throw new Error(`Season rounds need at least two round-robin rounds, got ${rounds.length}`);
  }
  return [...rounds, first.map(swapVenue), second.map(swapVenue)];
}
