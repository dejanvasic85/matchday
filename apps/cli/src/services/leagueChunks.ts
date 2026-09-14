// Splits the subscribed leagues into a capped number of groups, one per crawl-leagues matrix job.

/**
 * Deal `leagueIds` round-robin into at most `maxChunks` groups. Round-robin rather than
 * contiguous slices: leagues sit next to each other in subscription order, not by how long they
 * take, so dealing spreads a slow run of them instead of landing it all on one job.
 */
export function chunkLeagueIds(leagueIds: string[], maxChunks: number): string[][] {
  if (leagueIds.length === 0 || maxChunks < 1) {
    return [];
  }
  const chunkCount = Math.min(maxChunks, leagueIds.length);
  const chunks: string[][] = Array.from({ length: chunkCount }, () => []);
  leagueIds.forEach((leagueId, index) => {
    chunks[index % chunkCount]?.push(leagueId);
  });
  return chunks;
}
