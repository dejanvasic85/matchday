import { fixtureResponseSchema } from "#schemas/fixtureSchema.ts";
import { leagueResponseSchema } from "#schemas/leagueSchema.ts";
import { tableEntryResponseSchema } from "#schemas/tableEntrySchema.ts";
import { teamResponseSchema } from "#schemas/teamSchema.ts";

/** A league plus everything one league page renders. Every collection is always present — an
 * empty league yields empty arrays, never a missing key. */
export const leagueOverviewResponseSchema = leagueResponseSchema
  .extend({
    fixtures: fixtureResponseSchema.array(),
    table: tableEntryResponseSchema.array(),
    teams: teamResponseSchema.array(),
  })
  .openapi("LeagueOverview");
