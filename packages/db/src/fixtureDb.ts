// Fixture data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import { asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { fixture } from "#schema.ts";

type Fixture = typeof fixture.$inferSelect;
type FixtureInsert = typeof fixture.$inferInsert;

/** A league's fixtures, round-then-kickoff ordered — the shape a fixture list/table page reads
 * naturally in (0045, subscription-scoped per ADR 0012). */
export async function listFixturesByLeagueId(db: Db, leagueId: string): Promise<Result<Fixture[]>> {
  return runQuery(
    () =>
      db
        .select()
        .from(fixture)
        .where(eq(fixture.leagueId, leagueId))
        .orderBy(asc(fixture.round), asc(fixture.kickoffAt)),
    "Failed to list fixtures by league id",
  );
}

export async function upsertFixture(db: Db, values: FixtureInsert): Promise<Result<Fixture>> {
  return runUpsert(
    () =>
      db
        .insert(fixture)
        .values(values)
        .onConflictDoUpdate({
          target: fixture.id,
          set: {
            leagueId: values.leagueId,
            competitionId: values.competitionId,
            seasonId: values.seasonId,
            round: values.round ?? null,
            homeTeamId: values.homeTeamId ?? null,
            awayTeamId: values.awayTeamId ?? null,
            venue: values.venue ?? null,
            latitude: values.latitude ?? null,
            longitude: values.longitude ?? null,
            kickoffAt: values.kickoffAt ?? null,
            status: values.status,
            homeScore: values.homeScore ?? null,
            awayScore: values.awayScore ?? null,
            isBye: values.isBye,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "fixture",
    values,
  );
}
