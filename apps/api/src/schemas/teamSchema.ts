import { z } from "@hono/zod-openapi";

/** Lean embed of a team's owning club — not the full Club resource (skips socials, grounds,
 * email, etc.), just enough to render a team without a second request. */
const clubSummarySchema = z
  .object({
    id: z.string().openapi({ example: "clb_V1StGXR8Z5" }),
    name: z.string(),
    displayName: z.string(),
    logoUrl: z.string().nullable(),
  })
  .openapi("ClubSummary");

const baseTeamFields = {
  id: z.string().openapi({ example: "tea_V1StGXR8Z5" }),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/** A team resolved to its club — the common case (6499 of 6507 teams in prod). `club` is
 * guaranteed present, never null: a nullable field here would force every consumer to null-check
 * a case that's rare, temporary, and self-healing (see `unaffiliatedTeamResponseSchema`). */
const clubTeamResponseSchema = z
  .object({ type: z.literal("club"), ...baseTeamFields, club: clubSummarySchema })
  .openapi("ClubTeam");

/** A team the catalog crawl discovered from a fixture but couldn't yet bridge to a club by name
 * or logo (teamResolver.ts's `resolveTeamForFixture`) — every subsequent sighting retries the
 * bridge, so this self-heals into a `ClubTeam` once the club is seen elsewhere. Rare enough
 * (0.1% of teams in prod) that modelling it as its own variant, rather than a nullable `club` on
 * every team, keeps the common case null-check-free. */
const unaffiliatedTeamResponseSchema = z
  .object({ type: z.literal("unaffiliated"), ...baseTeamFields })
  .openapi("UnaffiliatedTeam");

/** Wire shape of a team (mirrors @matchday/domain's teamSchema, dates as ISO strings), split by
 * `type` on whether the team has been bridged to a club yet. */
export const teamResponseSchema = z
  .discriminatedUnion("type", [clubTeamResponseSchema, unaffiliatedTeamResponseSchema])
  .openapi("Team");
