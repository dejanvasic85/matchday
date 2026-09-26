import { z } from "zod";
import { isoDateSchema } from "#calendarDate.ts";

/** A competition's run in a season — the "competition edition". It owns the calendar window, because
 * the same season label covers competitions that run on different calendars. A league belongs to
 * one of these through its `(competitionId, seasonId)` pair. */
export const competitionSeasonSchema = z.object({
  id: z.string(),
  competitionId: z.string(),
  seasonId: z.string(),
  // Nullable: an operator sets them by hand when the source gives none.
  startsOn: isoDateSchema.nullable(),
  endsOn: isoDateSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CompetitionSeason = z.infer<typeof competitionSeasonSchema>;
