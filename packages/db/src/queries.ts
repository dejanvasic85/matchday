// Data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { err, ok, type Result } from "@matchday/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { Source } from "./constants.ts";
import { club, externalRef } from "./schema.ts";

type Club = typeof club.$inferSelect;
type ExternalRef = typeof externalRef.$inferSelect;
type ExternalRefInsert = typeof externalRef.$inferInsert;

function toError(cause: unknown, message: string): Result<never> {
  return err({ message, cause });
}

export async function listClubs(db: Db): Promise<Result<Club[]>> {
  try {
    const rows = await db.select().from(club);
    return ok(rows);
  } catch (cause) {
    return toError(cause, "Failed to list clubs");
  }
}

export async function getClubById(db: Db, id: string): Promise<Result<Club | null>> {
  try {
    const rows = await db.select().from(club).where(eq(club.id, id)).limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to get club by id");
  }
}

/**
 * Upsert an external reference by its `(source, sourceId)` idempotency key (ADR 0005): insert it,
 * or update the mapping/metadata if that source hash is already known. The single primitive the
 * scraper's idempotent re-scraping (Phase 3) builds on.
 */
export async function upsertExternalRef(
  db: Db,
  ref: ExternalRefInsert,
): Promise<Result<ExternalRef>> {
  try {
    const rows = await db
      .insert(externalRef)
      .values(ref)
      .onConflictDoUpdate({
        target: [externalRef.source, externalRef.sourceId],
        set: {
          entityType: ref.entityType,
          internalId: ref.internalId,
          sourceUrl: ref.sourceUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return toError(ref, "Upsert of external ref returned no row");
    }
    return ok(row);
  } catch (cause) {
    return toError(cause, "Failed to upsert external ref");
  }
}

export async function findExternalRef(
  db: Db,
  source: Source,
  sourceId: string,
): Promise<Result<ExternalRef | null>> {
  try {
    const rows = await db
      .select()
      .from(externalRef)
      .where(and(eq(externalRef.source, source), eq(externalRef.sourceId, sourceId)))
      .limit(1);
    return ok(rows[0] ?? null);
  } catch (cause) {
    return toError(cause, "Failed to find external ref");
  }
}
