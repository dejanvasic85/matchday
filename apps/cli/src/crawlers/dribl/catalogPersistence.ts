// Persists a catalog crawl: upserts competition/season/league via external_ref, then resolves each table entry's club/team.
// `persistLeague` is called per-league so a DB failure surfaces early with prior leagues already committed.

import {
  externalRefEntityTypeValue,
  generateId,
  ok,
  type Logger,
  type Result,
} from "@matchday/domain";
import type { CrawlCatalogLeagueResult } from "#crawlers/dribl/catalogCrawler.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/dribl/externalRefEntityResolver.ts";
import { resolveTableEntryEntities } from "#crawlers/dribl/tableEntryEntityResolver.ts";
import { resolveTeamForFixture } from "#crawlers/dribl/teamResolver.ts";

export type PersistLeagueInput = {
  deps: EntityResolutionDeps;
  logger: Logger;
  league: CrawlCatalogLeagueResult;
};

export type PersistCatalogInput = {
  deps: EntityResolutionDeps;
  logger: Logger;
  leagues: CrawlCatalogLeagueResult[];
};

/** Season ids already warned about in this crawl, so one undated season logs one line, not one per
 * league that happens to reference it. */
export type WarnedSeasons = Set<string>;

export type PersistLeagueSummary = {
  tableEntries: number;
  fixtureTeams: number;
};

export type PersistCatalogSummary = {
  leagues: number;
  tableEntries: number;
  fixtureTeams: number;
};

/** Warn once per season when it has no calendar window: per-club season resolution can't place it
 * on "today". Cleared by `mday season set-dates`; a generated source writes its own dates. */
async function warnIfSeasonUndated(
  deps: EntityResolutionDeps,
  logger: Logger,
  seasonId: string,
  warned: WarnedSeasons,
): Promise<void> {
  if (warned.has(seasonId)) {
    return;
  }
  warned.add(seasonId);

  const seasonResult = await deps.getSeasonById(seasonId);
  if (!seasonResult.ok || seasonResult.value === null) {
    return;
  }
  const { name, startsOn, endsOn } = seasonResult.value;
  if (startsOn !== null && endsOn !== null) {
    return;
  }
  logger.warn("catalog.season.undated", "season has no dates", {
    season: name,
    seasonId,
    hint: `run \`mday season set-dates ${name} --starts <date> --ends <date>\``,
  });
}

export async function persistLeague(
  input: PersistLeagueInput,
  warned: WarnedSeasons = new Set(),
): Promise<Result<PersistLeagueSummary>> {
  const { deps, logger, league } = input;

  const competitionResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.competition,
    sourceId: league.competitionSourceId,
    upsertEntity: (id) => deps.upsertCompetition({ id, name: league.competitionName }),
  });
  if (!competitionResult.ok) {
    return competitionResult;
  }

  const seasonResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.season,
    sourceId: league.seasonSourceId,
    upsertEntity: (id) => deps.upsertSeason({ id, name: league.seasonName }),
  });
  if (!seasonResult.ok) {
    return seasonResult;
  }

  // Per-club season resolution can't place a dateless season on "today", so warn an operator to
  // run `mday season set-dates`. A generated source writes its own dates, so this stays quiet.
  await warnIfSeasonUndated(deps, logger, seasonResult.value, warned);

  const leagueResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.league,
    sourceId: league.leagueSourceId,
    upsertEntity: (id) =>
      deps.upsertLeague({
        id,
        name: league.leagueName,
        competitionId: competitionResult.value,
        seasonId: seasonResult.value,
        hasTable: league.tableEntries.length > 0,
      }),
  });
  if (!leagueResult.ok) {
    return leagueResult;
  }

  const context = {
    competitionId: competitionResult.value,
    seasonId: seasonResult.value,
    leagueId: leagueResult.value,
  };

  for (const entry of league.tableEntries) {
    const entryResult = await resolveTableEntryEntities(deps, entry, context);
    if (!entryResult.ok) {
      return entryResult;
    }
  }

  for (const fixtureTeam of league.fixtureTeams) {
    const teamResult = await resolveTeamForFixture(
      deps,
      logger,
      fixtureTeam.sourceId,
      fixtureTeam.name,
      fixtureTeam.logoUrl,
    );
    if (!teamResult.ok) {
      return teamResult;
    }

    // Table-less leagues (MiniRoos etc.) never get a table_entry row, so this is the only place
    // membership is recorded for them.
    const membership = await deps.upsertLeagueTeam({
      id: generateId("leagueTeam"),
      leagueId: context.leagueId,
      teamId: teamResult.value,
    });
    if (!membership.ok) {
      return membership;
    }
  }

  logger.info("catalog.persist.league", "persisted league", {
    competition: league.competitionName,
    league: league.leagueName,
    leagueId: leagueResult.value,
    tableEntries: league.tableEntries.length,
    fixtureTeams: league.fixtureTeams.length,
  });

  return ok({ tableEntries: league.tableEntries.length, fixtureTeams: league.fixtureTeams.length });
}

export async function persistCatalog(
  input: PersistCatalogInput,
): Promise<Result<PersistCatalogSummary>> {
  const { deps, logger, leagues } = input;

  let tableEntryCount = 0;
  let fixtureTeamCount = 0;
  const warned: WarnedSeasons = new Set();

  for (const league of leagues) {
    const result = await persistLeague({ deps, logger, league }, warned);
    if (!result.ok) {
      return result;
    }
    tableEntryCount += result.value.tableEntries;
    fixtureTeamCount += result.value.fixtureTeams;
  }

  return ok({
    leagues: leagues.length,
    tableEntries: tableEntryCount,
    fixtureTeams: fixtureTeamCount,
  });
}
