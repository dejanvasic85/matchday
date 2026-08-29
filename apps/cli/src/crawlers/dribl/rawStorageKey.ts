// Raw R2 object key layout: one object per API response, keyed so a crawl run's objects
// group together and the 7-day lifecycle rule can expire the whole prefix uniformly.

export function buildRawFixturesKey(
  leagueId: string,
  crawlRunId: string,
  round: number,
  pageNumber: number,
): string {
  return `deep/${leagueId}/${crawlRunId}/fixtures-round-${round}-page-${pageNumber}.json`;
}

/** Table-less leagues are crawled as Dribl's current fixture window, which spans rounds — so its
 * pages are keyed by window position rather than by a round they don't belong to. */
export function buildRawFixtureWindowKey(
  leagueId: string,
  crawlRunId: string,
  pageNumber: number,
): string {
  return `deep/${leagueId}/${crawlRunId}/fixtures-window-page-${pageNumber}.json`;
}

export function buildRawTableKey(leagueId: string, crawlRunId: string): string {
  return `deep/${leagueId}/${crawlRunId}/table.json`;
}

export function buildRawClubEnrichmentKey(crawlRunId: string, clubSourceId: string): string {
  return `club-enrichment/${crawlRunId}/club-${clubSourceId}.json`;
}
