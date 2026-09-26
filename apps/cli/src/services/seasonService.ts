// Season summaries for `mday season list`: a flat one-row-per-competition window, independent of
// how it's displayed, so `--json` prints it untouched.

import type { IsoDate, Source } from "@matchday/domain";
import type { CompetitionSeasonWindow } from "@matchday/db";

export type SeasonWindowSummary = {
  source: Source;
  seasonId: string;
  seasonName: string;
  competitionId: string;
  competitionName: string;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

/** Names the fields the CLI needs and drops anything joined in for convenience, so the JSON
 * output is the season, competition and window and nothing else. */
export function toSeasonWindowSummary(row: CompetitionSeasonWindow): SeasonWindowSummary {
  return {
    source: row.source,
    seasonId: row.seasonId,
    seasonName: row.seasonName,
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  };
}
