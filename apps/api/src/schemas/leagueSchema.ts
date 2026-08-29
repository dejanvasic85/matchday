import { z } from "@hono/zod-openapi";

/** Competition and season are `{ id, name }` and nothing else, so their summaries are the same
 * two fields — but each needs its own OpenAPI component name to read well in a generated client. */
function summarySchema(componentName: string, idExample: string) {
  return z
    .object({ id: z.string().openapi({ example: idExample }), name: z.string() })
    .openapi(componentName);
}

/** Wire shape of a league (mirrors @matchday/domain's leagueSchema, dates as ISO strings).
 * `competition`/`season` are embedded so labelling a league needs no follow-up requests. */
export const leagueResponseSchema = z
  .object({
    id: z.string().openapi({ example: "lea_V1StGXR8Z5" }),
    name: z.string(),
    competitionId: z.string(),
    seasonId: z.string(),
    competition: summarySchema("CompetitionSummary", "cmp_V1StGXR8Z5"),
    season: summarySchema("SeasonSummary", "sea_V1StGXR8Z5"),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("League");
