// External ref data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { ExternalRefEntityType, Source } from "./constants.ts";
import { runQuery, runUpsert } from "./runQuery.ts";
import { externalRef } from "./schema.ts";

type ExternalRef = typeof externalRef.$inferSelect;
type ExternalRefInsert = typeof externalRef.$inferInsert;

/**
 * Upsert an external reference by its `(source, sourceId)` idempotency key (ADR 0005): insert it,
 * or update the mapping/metadata if that source hash is already known. The single primitive the
 * crawler's idempotent re-scraping (Phase 3) builds on.
 */
export async function upsertExternalRef(
  db: Db,
  ref: ExternalRefInsert,
): Promise<Result<ExternalRef>> {
  return runUpsert(
    () =>
      db
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
        .returning(),
    "external ref",
    ref,
  );
}

export async function findExternalRef(
  db: Db,
  source: Source,
  sourceId: string,
): Promise<Result<ExternalRef | null>> {
  const result = await runQuery(
    () =>
      db
        .select()
        .from(externalRef)
        .where(and(eq(externalRef.source, source), eq(externalRef.sourceId, sourceId)))
        .limit(1),
    "Failed to find external ref",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/**
 * Reverse of {@link findExternalRef}: given an entity's internal id, find its ref for a given
 * source (e.g. resolving a `lea_` id back to the Dribl league hash it was catalogued under).
 */
export async function findExternalRefByInternalId(
  db: Db,
  entityType: ExternalRefEntityType,
  internalId: string,
  source: Source,
): Promise<Result<ExternalRef | null>> {
  const result = await runQuery(
    () =>
      db
        .select()
        .from(externalRef)
        .where(
          and(
            eq(externalRef.entityType, entityType),
            eq(externalRef.internalId, internalId),
            eq(externalRef.source, source),
          ),
        )
        .limit(1),
    "Failed to find external ref by internal id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
