// The idempotency contract for the Coastal source: a league crawl at the same moment writes the
// same rows, and a crawl a week later changes only the matches played in that week — so the
// change webhook reports that weekend's results and nothing else.

import { fixtureStatusValue, ok, type Source } from "@matchday/domain";
import type { schema } from "@matchday/db";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import {
  persistLeagueSeason,
  type PersistLeagueSeasonInput,
} from "#crawlers/coastal/leaguePersistence.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";
import { detectLeagueChanges, type LeagueSnapshot } from "#services/leagueChangeDetector.ts";
import { makeCoastalExternalRefRow, makeCoastalHappyPathDeps } from "#test/fixtures/coastalDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";

type FixtureInsert = Parameters<EntityResolutionDeps["upsertFixture"]>[0];
type TableEntryInsert = Parameters<EntityResolutionDeps["upsertTableEntry"]>[0];
type ExternalRefInsert = Parameters<EntityResolutionDeps["upsertExternalRef"]>[0];
type FixtureRow = typeof schema.fixture.$inferSelect;
type TableEntryRow = typeof schema.tableEntry.$inferSelect;

type CapturedRun = {
  fixtures: FixtureInsert[];
  tableEntries: TableEntryInsert[];
};

const epoch = new Date("2026-06-01T00:00:00.000Z");
// A Monday mid-season, after the previous weekend's matches have finished and before the next.
const moment = new Date("2026-11-02T00:00:00.000Z");
const weekLater = new Date("2026-11-09T00:00:00.000Z");

const input: PersistLeagueSeasonInput = {
  competitionId: "cmp_abc123",
  seasonId: "sea_abc123",
  leagueId: "lea_abc123",
  season: seasonWindowForYear(2026),
};

/** Deps whose external_refs persist across crawls, so a re-crawl resolves the same internal ids. */
function makeStableDeps(): EntityResolutionDeps {
  const refs = new Map<string, string>();
  return makeCoastalHappyPathDeps({
    findExternalRef: vi
      .fn()
      .mockImplementation((_source: Source, sourceId: string) =>
        Promise.resolve(
          ok(refs.has(sourceId) ? makeCoastalExternalRefRow(sourceId, refs.get(sourceId)) : null),
        ),
      ),
    upsertExternalRef: vi.fn().mockImplementation((values: ExternalRefInsert) => {
      refs.set(values.sourceId, values.internalId);
      return Promise.resolve(ok(makeCoastalExternalRefRow(values.sourceId, values.internalId)));
    }),
  });
}

async function crawlAndCapture(deps: EntityResolutionDeps, now: Date): Promise<CapturedRun> {
  const result = await persistLeagueSeason(deps, makeFakeLogger(), input, now);
  if (!result.ok) {
    throw new Error("coastal league crawl failed");
  }
  const fixtures = vi.mocked(deps.upsertFixture).mock.calls.map(([values]) => values);
  const tableEntries = vi.mocked(deps.upsertTableEntry).mock.calls.map(([values]) => values);
  vi.mocked(deps.upsertFixture).mockClear();
  vi.mocked(deps.upsertTableEntry).mockClear();
  return { fixtures, tableEntries };
}

function changedFixtureIds(before: FixtureInsert[], after: FixtureInsert[]): Set<string> {
  const beforeById = new Map(before.map((fixture) => [fixture.id, fixture]));
  const changed = new Set<string>();
  for (const fixture of after) {
    const previous = beforeById.get(fixture.id);
    if (
      previous === undefined ||
      previous.status !== fixture.status ||
      previous.homeScore !== fixture.homeScore ||
      previous.awayScore !== fixture.awayScore ||
      previous.kickoffAt?.getTime() !== fixture.kickoffAt?.getTime()
    ) {
      changed.add(fixture.id);
    }
  }
  return changed;
}

function withoutId(value: { id: string }): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id"));
}

/** `?? null` in one place: a chain of them in the mapper trips the complexity audit. */
function orNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function toFixtureRow(values: FixtureInsert): FixtureRow {
  return {
    id: values.id,
    leagueId: values.leagueId,
    competitionId: values.competitionId,
    seasonId: values.seasonId,
    round: orNull(values.round),
    homeTeamId: orNull(values.homeTeamId),
    awayTeamId: orNull(values.awayTeamId),
    venue: orNull(values.venue),
    latitude: orNull(values.latitude),
    longitude: orNull(values.longitude),
    kickoffAt: orNull(values.kickoffAt),
    status: values.status,
    homeScore: orNull(values.homeScore),
    awayScore: orNull(values.awayScore),
    isBye: values.isBye ?? false,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function toTableEntryRow(values: TableEntryInsert): TableEntryRow {
  return { ...values, createdAt: epoch, updatedAt: epoch };
}

function snapshot(run: CapturedRun): LeagueSnapshot {
  return {
    fixtures: run.fixtures.map(toFixtureRow),
    tableEntries: run.tableEntries.map(toTableEntryRow),
  };
}

describe("coastal idempotency", () => {
  it("writes identical rows when crawled twice at the same moment", async () => {
    const deps = makeStableDeps();
    const first = await crawlAndCapture(deps, moment);
    const second = await crawlAndCapture(deps, moment);

    expect(second.fixtures).toEqual(first.fixtures);
    expect(second.tableEntries.map(withoutId)).toEqual(first.tableEntries.map(withoutId));
  });

  it("changes only the fixtures played during the elapsed week", async () => {
    const deps = makeStableDeps();
    const first = await crawlAndCapture(deps, moment);
    const later = await crawlAndCapture(deps, weekLater);

    const changed = changedFixtureIds(first.fixtures, later.fixtures);
    expect(changed.size).toBeGreaterThan(0);

    const playedThisWeek = later.fixtures.filter(
      (fixture) =>
        fixture.status !== fixtureStatusValue.cancelled &&
        fixture.status !== fixtureStatusValue.postponed &&
        fixture.kickoffAt !== null &&
        fixture.kickoffAt !== undefined &&
        fixture.kickoffAt.getTime() >= moment.getTime() &&
        fixture.kickoffAt.getTime() <= weekLater.getTime(),
    );
    expect(changed).toEqual(new Set(playedThisWeek.map((fixture) => fixture.id)));
    expect(changed.size).toBeLessThan(40);
  });

  it("reports changes for that week's results only", async () => {
    const deps = makeStableDeps();
    const first = await crawlAndCapture(deps, moment);
    const later = await crawlAndCapture(deps, weekLater);
    const changed = changedFixtureIds(first.fixtures, later.fixtures);

    const sameMoment = detectLeagueChanges(snapshot(first), snapshot(first));
    expect(sameMoment.hasChanges).toBe(false);

    const nextWeek = detectLeagueChanges(snapshot(first), snapshot(later));
    expect(nextWeek.hasChanges).toBe(true);
    expect(nextWeek.fixturesChanged).toBe(changed.size);
    expect(nextWeek.tableChanged).toBe(true);
  });
});
