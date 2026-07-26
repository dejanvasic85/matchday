// Fixture data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runUpsert } from "./runQuery.ts";
import { fixture } from "./schema.ts";

type Fixture = typeof fixture.$inferSelect;
type FixtureInsert = typeof fixture.$inferInsert;

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
