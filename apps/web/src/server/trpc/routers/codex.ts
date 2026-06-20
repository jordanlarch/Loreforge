/**
 * Codex tRPC router — read-only SRD reference over the ingested Open5e data
 * (`codex_spells`). First library surface (P1 Codex MVP); the IA validated here
 * is reused by Smithy and Realms. Write paths (Copy to Smithy, etc.) arrive in
 * later phases.
 */
import { and, asc, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { codexClasses, codexSpecies, codexSpells, getDb } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

export const codexRouter = createTRPCRouter({
  /** Filterable, paginated list of SRD spells. */
  listSpells: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).optional(),
        level: z.string().optional(),
        school: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(48),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input.search ? ilike(codexSpells.name, `%${input.search}%`) : undefined,
        input.level ? eq(codexSpells.level, input.level) : undefined,
        input.school ? eq(codexSpells.school, input.school) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: codexSpells.id,
            slug: codexSpells.slug,
            name: codexSpells.name,
            level: codexSpells.level,
            school: codexSpells.school,
            source: codexSpells.source,
          })
          .from(codexSpells)
          .where(where)
          .orderBy(asc(codexSpells.level), asc(codexSpells.name))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(codexSpells).where(where),
      ]);

      return { spells: rows, total: total?.value ?? 0 };
    }),

  /** Distinct filter facets (levels + schools) for the sidebar. */
  spellFacets: protectedProcedure.query(async () => {
    const db = getDb();
    const [levels, schools] = await Promise.all([
      db
        .selectDistinct({ value: codexSpells.level })
        .from(codexSpells)
        .orderBy(asc(codexSpells.level)),
      db
        .selectDistinct({ value: codexSpells.school })
        .from(codexSpells)
        .orderBy(asc(codexSpells.school)),
    ]);
    return {
      levels: levels.map((l) => l.value).filter((v): v is string => v != null),
      schools: schools
        .map((s) => s.value)
        .filter((v): v is string => v != null),
    };
  }),

  /** Full SRD record for a single spell by slug. */
  getSpell: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexSpells)
        .where(eq(codexSpells.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Total ingested spell count (also used by Home status). */
  spellCount: protectedProcedure.query(async () => {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(codexSpells);
    return { count: row?.value ?? 0 };
  }),

  /** SRD species/lineages for the Creation Wizard, alphabetical. */
  listSpecies: protectedProcedure.query(async () => {
    const db = getDb();
    return db
      .select({
        slug: codexSpecies.slug,
        name: codexSpecies.name,
        abilityBonuses: codexSpecies.abilityBonuses,
        speed: codexSpecies.speed,
        size: codexSpecies.size,
        traits: codexSpecies.traits,
      })
      .from(codexSpecies)
      .orderBy(asc(codexSpecies.name));
  }),

  /** SRD classes for the Creation Wizard, alphabetical. */
  listClasses: protectedProcedure.query(async () => {
    const db = getDb();
    return db
      .select({
        slug: codexClasses.slug,
        name: codexClasses.name,
        hitDie: codexClasses.hitDie,
        savingThrows: codexClasses.savingThrows,
        skillChoice: codexClasses.skillChoice,
      })
      .from(codexClasses)
      .orderBy(asc(codexClasses.name));
  }),
});
