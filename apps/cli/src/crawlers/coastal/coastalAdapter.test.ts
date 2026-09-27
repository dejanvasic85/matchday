import { ok, type Result } from "@matchday/domain";
import type { CliConfig } from "#config.ts";
import { crawlSourceValue } from "#crawlers/constants.ts";
import { coastalAdapter, seasonFromRefSourceId } from "#crawlers/coastal/coastalAdapter.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";
import type { AssetStorage } from "#storage/assetStorage.ts";
import type { DownloadedImage } from "#storage/clubLogoMirror.ts";
import { makeCoastalExternalRefRow, makeCoastalHappyPathDeps } from "#test/fixtures/coastalDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeFakeRawStorage } from "#test/fixtures/rawStorage.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");
const seasonName = "2026-27";

function makeCliConfig(): CliConfig {
  return {
    DATABASE_URL: "https://example.neon.tech",
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_NAME: "bucket",
    R2_PUBLIC_ASSETS_URL: "https://assets.example.com",
    R2_RAW_BUCKET_NAME: "raw",
    LOG_LEVEL: "info",
  };
}

function makeLeagueRow() {
  return {
    id: "lea_abc123",
    name: "Coastal Premier League",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    hasTable: true,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

async function openSession() {
  const result = await coastalAdapter.openSession(makeCliConfig());
  if (!result.ok) {
    throw new Error("Coastal session failed to open");
  }
  return result.value;
}

describe("seasonFromRefSourceId", () => {
  it("builds the season from a season or league id", () => {
    expect(seasonFromRefSourceId("season-2026-27")).toEqual(ok(seasonWindowForYear(2026)));
    expect(seasonFromRefSourceId("league-2027-28")).toEqual(ok(seasonWindowForYear(2027)));
  });

  it("rejects an id that is neither a season nor a league", () => {
    expect(seasonFromRefSourceId("club-stadly-united").ok).toBe(false);
  });

  it("rejects an id with no four-digit start year", () => {
    expect(seasonFromRefSourceId("season-").ok).toBe(false);
    expect(seasonFromRefSourceId("season-26").ok).toBe(false);
  });
});

describe("coastalAdapter", () => {
  it("registers as the coastal source", () => {
    expect(coastalAdapter.source).toBe(crawlSourceValue.coastal);
  });

  it("counts a single catalog league", async () => {
    const session = await openSession();
    expect(await session.countCatalogLeagues({ logger: makeFakeLogger() })).toEqual(
      ok({ total: 1 }),
    );
  });

  it("persists a season, its clubs and every fixture on a catalog crawl", async () => {
    const deps = makeCoastalHappyPathDeps();
    const session = await openSession();

    const result = await session.crawlCatalog({
      deps,
      logger: makeFakeLogger(),
      seasonYear: "2026",
      dryRun: false,
    });

    expect(result).toEqual(
      ok({
        competitions: 1,
        leagues: 1,
        clubs: coastalClubs.length,
        teams: coastalClubs.length,
        tableEntries: 0,
      }),
    );
    expect(deps.upsertCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Coastal Premier League" }),
    );
    expect(deps.upsertSeason).toHaveBeenCalledWith(
      expect.objectContaining({ source: "coastal", name: seasonName }),
    );
    expect(deps.ensureCompetitionSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        startsOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endsOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(deps.upsertFixture).toHaveBeenCalledTimes(380);
    expect(deps.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", homeScore: null, awayScore: null }),
    );
  });

  it("writes nothing on a dry-run catalog crawl", async () => {
    const deps = makeCoastalHappyPathDeps();
    const session = await openSession();

    const result = await session.crawlCatalog({
      deps,
      logger: makeFakeLogger(),
      seasonYear: "2026",
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    expect(deps.upsertCompetition).not.toHaveBeenCalled();
    expect(deps.upsertFixture).not.toHaveBeenCalled();
  });

  it("persists results and the ladder on a league crawl", async () => {
    const deps = makeCoastalHappyPathDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockResolvedValue(ok(makeCoastalExternalRefRow(`season-${seasonName}`))),
    });
    const session = await openSession();

    const result = await session.crawlLeague({
      deps,
      rawStorage: makeFakeRawStorage(),
      logger: makeFakeLogger(),
      leagueId: "lea_abc123",
      dryRun: false,
    });

    expect(result).toEqual(ok({ fixtures: 380, tableEntries: coastalClubs.length }));
    expect(deps.upsertFixture).toHaveBeenCalledTimes(380);
    expect(deps.upsertTableEntry).toHaveBeenCalledTimes(coastalClubs.length);
  });

  it("fails a league crawl whose season cannot be resolved", async () => {
    const deps = makeCoastalHappyPathDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi.fn().mockResolvedValue(ok(null)),
    });
    const session = await openSession();

    const result = await session.crawlLeague({
      deps,
      rawStorage: makeFakeRawStorage(),
      logger: makeFakeLogger(),
      leagueId: "lea_abc123",
      dryRun: false,
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertFixture).not.toHaveBeenCalled();
  });

  it("treats club enrichment as a no-op", async () => {
    const assetStorage: AssetStorage = {
      putObject: vi.fn().mockResolvedValue(ok(undefined)),
    };
    const downloadImage = async (): Promise<Result<DownloadedImage>> =>
      ok({ bytes: new Uint8Array([1]), contentType: "image/png" });
    const session = await openSession();

    const result = await session.crawlClubEnrichment({
      deps: makeCoastalHappyPathDeps(),
      rawStorage: makeFakeRawStorage(),
      assetStorage,
      downloadImage,
      publicAssetsBaseUrl: "https://assets.example.com",
      logger: makeFakeLogger(),
      dryRun: false,
    });

    expect(result).toEqual(ok({ listed: 0, updated: 0, skipped: 0 }));
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });
});
