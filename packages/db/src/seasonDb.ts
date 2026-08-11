// Season data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { season } from "#schema.ts";

type Season = typeof season.$inferSelect;
type SeasonInsert = typeof season.$inferInsert;

export async function listSeasons(db: Db): Promise<Result<Season[]>> {
  return runQuery(() => db.select().from(season), "Failed to list seasons");
}

export async function getSeasonById(db: Db, id: string): Promise<Result<Season | null>> {
  const result = await runQuery(
    () => db.select().from(season).where(eq(season.id, id)).limit(1),
    "Failed to get season by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

export async function upsertSeason(db: Db, values: SeasonInsert): Promise<Result<Season>> {
  return runUpsert(
    () =>
      db
        .insert(season)
        .values(values)
        .onConflictDoUpdate({
          target: season.id,
          set: { name: values.name, updatedAt: new Date() },
        })
        .returning(),
    "season",
    values,
  );
}
