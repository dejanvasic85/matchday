// Club data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { asc, eq, ilike, sql } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { club } from "#schema.ts";

type Club = typeof club.$inferSelect;
type ClubInsert = typeof club.$inferInsert;

export async function listClubs(db: Db): Promise<Result<Club[]>> {
  return runQuery(() => db.select().from(club), "Failed to list clubs");
}

export async function getClubById(db: Db, id: string): Promise<Result<Club | null>> {
  const result = await runQuery(
    () => db.select().from(club).where(eq(club.id, id)).limit(1),
    "Failed to get club by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/**
 * Find a club by its exact logo URL — the more precise of the two lookups (avoids name
 * collisions between similarly-named clubs), tried first when linking a team to a club from
 * table-entry data, which carries only a club name/logo (no stable Dribl club id).
 */
export async function findClubByLogoUrl(db: Db, logoUrl: string): Promise<Result<Club | null>> {
  const result = await runQuery(
    () => db.select().from(club).where(eq(club.logoUrl, logoUrl)).limit(1),
    "Failed to find club by logo url",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/**
 * Find a club by its exact name — the fallback when no logo match is found. The clubs-sync job
 * (Phase 3, not yet built) is the source of truth for club identity and matches by name/logo to
 * attach its external_ref to whichever club row this created, rather than creating a duplicate.
 */
export async function findClubByName(db: Db, name: string): Promise<Result<Club | null>> {
  const result = await runQuery(
    () => db.select().from(club).where(eq(club.name, name)).limit(1),
    "Failed to find club by name",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/**
 * Find clubs by a case-insensitive partial name match — the operator lookup behind
 * `mday club leagues` and `client add-subscription --club` (#85), where the operator types a
 * human-recognisable fragment ("Williamstown") rather than the exact stored name. Returns every
 * match so the caller (clubResolver) can fail on ambiguity instead of guessing.
 */
export async function findClubsByName(db: Db, query: string): Promise<Result<Club[]>> {
  return runQuery(
    () =>
      db
        .select()
        .from(club)
        .where(ilike(club.name, `%${query}%`))
        .orderBy(asc(club.name)),
    "Failed to find clubs by name",
  );
}

/**
 * Upsert a club by its (already-generated) id: insert it, or refresh its scraped fields if the
 * id is already known. The entity-resolution service (Phase 3) generates the id up front so it
 * can also write the matching `external_ref` row in the same call.
 *
 * `name`/`displayName` are always overwritten (deep-crawl-owned). `logoUrl`/`email`/`website`/
 * `address`/`socials` use SQL `COALESCE` on the update branch instead: a caller passes `null` to
 * mean "I have nothing better, leave the existing value alone" rather than clobbering curated
 * data. resolveClub (deep crawl) relies on exactly this — it passes `null` logoUrl once a club is
 * already identity-resolved, so the club-enrichment job's R2-mirrored logo (and its
 * email/website/address/socials) survive subsequent re-crawls instead of being wiped every time.
 */
export async function upsertClub(db: Db, values: ClubInsert): Promise<Result<Club>> {
  return runUpsert(
    () =>
      db
        .insert(club)
        .values(values)
        .onConflictDoUpdate({
          target: club.id,
          set: {
            name: values.name,
            displayName: values.displayName,
            logoUrl: sql`coalesce(${values.logoUrl ?? null}, ${club.logoUrl})`,
            email: sql`coalesce(${values.email ?? null}, ${club.email})`,
            website: sql`coalesce(${values.website ?? null}, ${club.website})`,
            address: sql`coalesce(${values.address ?? null}, ${club.address})`,
            socials: sql`coalesce(${values.socials ?? null}, ${club.socials})`,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "club",
    values,
  );
}

export type ClubEnrichmentFields = Pick<
  ClubInsert,
  "logoUrl" | "email" | "website" | "address" | "socials" | "grounds" | "color" | "accent" | "store"
>;

/**
 * Update-only write for the club-enrichment job (never creates a row — "attach, never create" per
 * ADR 0012): a plain `UPDATE ... WHERE id`, no insert branch, so the guarantee is structural
 * rather than relying on every caller happening to pass an existing id. Zero rows updated (the
 * club id vanished between resolution and this call) is a soft no-op (`ok(null)`), not an error —
 * not worth failing the whole enrichment run over one club.
 */
export async function updateClubEnrichmentFields(
  db: Db,
  id: string,
  fields: ClubEnrichmentFields,
): Promise<Result<Club | null>> {
  const result = await runQuery(
    () =>
      db
        .update(club)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(club.id, id))
        .returning(),
    "Failed to update club enrichment fields",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
