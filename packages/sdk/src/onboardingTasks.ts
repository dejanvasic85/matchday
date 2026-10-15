// Task helpers for onboarding a club through the API: follow it, ask for its league to be crawled,
// and unfollow it. They write, so unlike the read helpers they are never retried.

import type { components } from "#generated/schema.d.ts";
import type { MatchdayClient, MatchdayRequestInit } from "#client.ts";
import { unwrap, unwrapNoContent, type Result } from "#result.ts";

type ClubFollow = components["schemas"]["ClubFollow"];
type CrawlTarget = components["schemas"]["CrawlTarget"];

/** Follow a club and set its webhook, which must be https with a public hostname. Each call
 * issues a new `webhookSecret`, so keep the latest one. */
export async function followClub(
  client: MatchdayClient,
  clubId: string,
  webhookUrl: string,
  init?: MatchdayRequestInit,
): Promise<Result<ClubFollow>> {
  return unwrap(
    await client.POST("/clubs/{id}/follow", {
      ...init,
      params: { path: { id: clubId } },
      headers: undefined,
      body: { webhookUrl },
    }),
  );
}

/** Stop following a club. Fails with status 404 when the token's client doesn't follow it. */
export async function unfollowClub(
  client: MatchdayClient,
  clubId: string,
  init?: MatchdayRequestInit,
): Promise<Result<void>> {
  return unwrapNoContent(
    await client.DELETE("/clubs/{id}/follow", {
      ...init,
      params: { path: { id: clubId } },
      headers: undefined,
      body: undefined,
    }),
  );
}

/** Ask for a league to be crawled; any season's id works, and adding it again changes nothing.
 * `currentLeagueId` is the edition the next crawl visits, or null when none is crawlable yet. */
export async function addLeagueCrawlTarget(
  client: MatchdayClient,
  leagueId: string,
  init?: MatchdayRequestInit,
): Promise<Result<CrawlTarget>> {
  return unwrap(
    await client.PUT("/leagues/{id}/crawl-target", {
      ...init,
      params: { path: { id: leagueId } },
      headers: undefined,
      body: undefined,
    }),
  );
}
