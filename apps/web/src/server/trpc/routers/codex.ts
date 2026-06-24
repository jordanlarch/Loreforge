/**
 * Codex tRPC router — read-only SRD reference over the ingested Open5e data
 * (`codex_spells`). First library surface (P1 Codex MVP); the IA validated here
 * is reused by Smithy and Realms. Write paths (Copy to Smithy, etc.) arrive in
 * later phases.
 */
import { and, asc, count, eq, gte, ilike, lte } from "drizzle-orm";
import { z } from "zod";

import {
  codexClasses,
  codexItems,
  codexMonsters,
  codexSpecies,
  codexSpells,
  getDb,
} from "@app/db";

import { sortSizes } from "@/lib/codex-monster-filters";

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
  listSpecies: protectedProcedure
    .input(z.object({ search: z.string().trim().max(100).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.search
        ? ilike(codexSpecies.name, `%${input.search}%`)
        : undefined;
      return db
        .select({
          slug: codexSpecies.slug,
          name: codexSpecies.name,
          description: codexSpecies.description,
          abilityBonuses: codexSpecies.abilityBonuses,
          speed: codexSpecies.speed,
          size: codexSpecies.size,
          traits: codexSpecies.traits,
        })
        .from(codexSpecies)
        .where(where)
        .orderBy(asc(codexSpecies.name));
    }),

  /** Full SRD species record by slug. */
  getSpecies: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexSpecies)
        .where(eq(codexSpecies.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** SRD classes for the Creation Wizard, alphabetical. */
  listClasses: protectedProcedure
    .input(z.object({ search: z.string().trim().max(100).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.search
        ? ilike(codexClasses.name, `%${input.search}%`)
        : undefined;
      return db
        .select({
          slug: codexClasses.slug,
          name: codexClasses.name,
          description: codexClasses.description,
          hitDie: codexClasses.hitDie,
          savingThrows: codexClasses.savingThrows,
          skillChoice: codexClasses.skillChoice,
        })
        .from(codexClasses)
        .where(where)
        .orderBy(asc(codexClasses.name));
    }),

  /** Full SRD class record by slug. */
  getClass: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexClasses)
        .where(eq(codexClasses.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Filterable, paginated list of SRD creatures (Monsters + Animals tabs). */
  listMonsters: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).optional(),
        /** Open5e type key filter, e.g. beast, dragon. */
        type: z.string().trim().max(40).optional(),
        /** Open5e size key filter, e.g. medium, large. */
        size: z.string().trim().max(20).optional(),
        /** Animals tab: beasts with CR ≤ 1. */
        beastsOnly: z.boolean().optional(),
        crMin: z.number().min(0).optional(),
        crMax: z.number().min(0).optional(),
        limit: z.number().int().min(1).max(100).default(48),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input.search
          ? ilike(codexMonsters.name, `%${input.search}%`)
          : undefined,
        input.type ? eq(codexMonsters.creatureType, input.type) : undefined,
        input.size ? eq(codexMonsters.size, input.size) : undefined,
        input.beastsOnly
          ? and(
              eq(codexMonsters.creatureType, "beast"),
              lte(codexMonsters.challengeRating, 1),
            )
          : undefined,
        input.crMin != null
          ? gte(codexMonsters.challengeRating, input.crMin)
          : undefined,
        input.crMax != null
          ? lte(codexMonsters.challengeRating, input.crMax)
          : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: codexMonsters.id,
            slug: codexMonsters.slug,
            name: codexMonsters.name,
            creatureType: codexMonsters.creatureType,
            size: codexMonsters.size,
            challengeRating: codexMonsters.challengeRating,
            armorClass: codexMonsters.armorClass,
            hitPoints: codexMonsters.hitPoints,
          })
          .from(codexMonsters)
          .where(where)
          .orderBy(asc(codexMonsters.challengeRating), asc(codexMonsters.name))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(codexMonsters).where(where),
      ]);

      return { monsters: rows, total: total?.value ?? 0 };
    }),

  /** Distinct creature types and sizes for filter chips. */
  monsterFacets: protectedProcedure
    .input(z.object({ beastsOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const scope = input?.beastsOnly
        ? and(
            eq(codexMonsters.creatureType, "beast"),
            lte(codexMonsters.challengeRating, 1),
          )
        : undefined;

      const [types, sizes] = await Promise.all([
        db
          .selectDistinct({ value: codexMonsters.creatureType })
          .from(codexMonsters)
          .where(scope)
          .orderBy(asc(codexMonsters.creatureType)),
        db
          .selectDistinct({ value: codexMonsters.size })
          .from(codexMonsters)
          .where(scope)
          .orderBy(asc(codexMonsters.size)),
      ]);

      return {
        types: types
          .map((t) => t.value)
          .filter((v): v is string => v != null),
        sizes: sortSizes(
          sizes.map((s) => s.value).filter((v): v is string => v != null),
        ),
      };
    }),

  /** Full creature stat block by slug. */
  getMonster: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexMonsters)
        .where(eq(codexMonsters.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Total ingested creature count. */
  monsterCount: protectedProcedure.query(async () => {
    const db = getDb();
    const [row] = await db.select({ value: count() }).from(codexMonsters);
    return { count: row?.value ?? 0 };
  }),

  /** Filterable, paginated list of SRD items. */
  listItems: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).optional(),
        category: z.string().trim().max(40).optional(),
        limit: z.number().int().min(1).max(100).default(48),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input.search
          ? ilike(codexItems.name, `%${input.search}%`)
          : undefined,
        input.category ? eq(codexItems.category, input.category) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: codexItems.id,
            slug: codexItems.slug,
            name: codexItems.name,
            category: codexItems.category,
            cost: codexItems.cost,
            weight: codexItems.weight,
            weightUnit: codexItems.weightUnit,
          })
          .from(codexItems)
          .where(where)
          .orderBy(asc(codexItems.name))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(codexItems).where(where),
      ]);

      return { items: rows, total: total?.value ?? 0 };
    }),

  /** Distinct item categories for filter chips. */
  itemFacets: protectedProcedure.query(async () => {
    const db = getDb();
    const categories = await db
      .selectDistinct({ value: codexItems.category })
      .from(codexItems)
      .orderBy(asc(codexItems.category));
    return {
      categories: categories
        .map((c) => c.value)
        .filter((v): v is string => v != null),
    };
  }),

  /** Full SRD item record by slug. */
  getItem: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexItems)
        .where(eq(codexItems.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Total ingested item count. */
  itemCount: protectedProcedure.query(async () => {
    const db = getDb();
    const [row] = await db.select({ value: count() }).from(codexItems);
    return { count: row?.value ?? 0 };
  }),
});
