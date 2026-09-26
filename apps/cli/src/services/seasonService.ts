// Season summaries for `mday season list`: the roster shape independent of how it's displayed,
// so `--json` prints it untouched.

import type { IsoDate } from "@matchday/domain";

type SeasonRow = {
  id: string;
  name: string;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

export type SeasonSummary = {
  id: string;
  name: string;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

/** Names the fields the CLI needs and drops the timestamp columns, so the JSON output is the
 * season's calendar and nothing else. */
export function toSeasonSummary(row: SeasonRow): SeasonSummary {
  return { id: row.id, name: row.name, startsOn: row.startsOn, endsOn: row.endsOn };
}
