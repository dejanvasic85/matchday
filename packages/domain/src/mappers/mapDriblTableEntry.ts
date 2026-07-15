// Dribl-raw -> domain mapper (0004: explicit named transform at the crawl boundary).
//
// Like fixtures, a raw table entry carries team/league/season *names* and a Dribl hash ID, not
// matchday's real entity IDs — resolving those is a service concern, not a pure mapper.

import type { DriblTableEntry } from "../external/driblTableEntry.ts";

export type MappedTableEntry = {
  teamSourceId: string;
  teamName: string;
  clubName: string;
  clubLogoUrl: string | null;
  leagueName: string;
  seasonName: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function mapDriblTableEntry(entry: DriblTableEntry): MappedTableEntry {
  const { attributes } = entry;

  return {
    teamSourceId: attributes.team_hash_id,
    teamName: attributes.team_name,
    // Trimmed so downstream name-based club matching (resolveClub, when no logo match exists)
    // isn't defeated by incidental whitespace in Dribl's HTML-sourced club names.
    clubName: attributes.club_name.trim(),
    clubLogoUrl: attributes.club_logo,
    leagueName: attributes.league_name,
    seasonName: attributes.season_name,
    position: attributes.position,
    played: attributes.played,
    won: attributes.won,
    drawn: attributes.drawn,
    lost: attributes.lost,
    goalsFor: attributes.goals_for,
    goalsAgainst: attributes.goals_against,
    goalDifference: attributes.goal_difference,
    points: attributes.points,
  };
}
