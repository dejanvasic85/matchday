// Raw R2 object key layout, per 0004: one object per API response, mirroring WSC's per-round
// chunking, keyed so a crawl run's objects are grouped and the 7-day lifecycle rule can expire
// the whole prefix uniformly.

export function buildRawFixturesKey(leagueId: string, crawlRunId: string, round: number): string {
  return `deep/${leagueId}/${crawlRunId}/fixtures-round-${round}.json`;
}

export function buildRawTableKey(leagueId: string, crawlRunId: string): string {
  return `deep/${leagueId}/${crawlRunId}/table.json`;
}
