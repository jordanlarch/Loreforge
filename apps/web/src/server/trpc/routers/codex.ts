/**
 * Codex tRPC router — read-only SRD reference over the ingested Open5e data
 * (`codex_spells`). First library surface (P1 Codex MVP); the IA validated here
 * is reused by Smithy and Realms. Write paths (Copy to Smithy, etc.) arrive in
 * later phases.
 */
import { and, asc, count, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { masteryFromOpen5eItemRaw } from "@app/engine";

import {
  codexAdvancedRules,
  codexBackgrounds,
  codexClasses,
  codexFeats,
  codexItems,
  codexMonsters,
  codexRuleChapters,
  codexRuleSections,
  codexSpecies,
  codexSpells,
  codexSubclasses,
  getDb,
} from "@app/db";

import { sortSizes } from "@/lib/codex-monster-filters";
import {
  backgroundBenefitSummary,
  backgroundFeatureEntries,
  backgroundOriginFeatName,
  backgroundSkillProficiencies,
} from "@/lib/codex-background-feat-display";
import { codexSpellFlags } from "@/lib/codex-spell-flags";
import { spellClassesFromRaw } from "@/lib/codex-spell-classes";

import { createTRPCRouter, protectedProcedure } from "../init";

const spellSortSchema = z.enum(["level", "name", "school"]);
const spellSortDirSchema = z.enum(["asc", "desc"]);

function spellOrderBy(
  sortBy: z.infer<typeof spellSortSchema>,
  sortDir: z.infer<typeof spellSortDirSchema>,
) {
  const levelExpr = sql<number>`cast(${codexSpells.level} as int)`;
  const primary =
    sortBy === "name"
      ? sortDir === "desc"
        ? desc(codexSpells.name)
        : asc(codexSpells.name)
      : sortBy === "school"
        ? sortDir === "desc"
          ? desc(codexSpells.school)
          : asc(codexSpells.school)
        : sortDir === "desc"
          ? desc(levelExpr)
          : asc(levelExpr);

  if (sortBy === "name") return [primary];
  return [primary, asc(codexSpells.name)];
}

export const codexRouter = createTRPCRouter({
  /** Filterable, paginated list of SRD spells. */
  listSpells: protectedProcedure
    .input(
      z.object({
        search: z.string().trim().max(100).optional(),
        level: z.string().optional(),
        school: z.string().optional(),
        concentration: z.boolean().optional(),
        ritual: z.boolean().optional(),
        spellClass: z.string().trim().max(80).optional(),
        sortBy: spellSortSchema.default("level"),
        sortDir: spellSortDirSchema.default("asc"),
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
        input.concentration === true
          ? sql`lower(${codexSpells.raw}->>'concentration') in ('yes', 'true')`
          : input.concentration === false
            ? sql`coalesce(lower(${codexSpells.raw}->>'concentration'), '') not in ('yes', 'true')`
            : undefined,
        input.ritual === true
          ? sql`lower(${codexSpells.raw}->>'ritual') in ('yes', 'true')`
          : input.ritual === false
            ? sql`coalesce(lower(${codexSpells.raw}->>'ritual'), '') not in ('yes', 'true')`
            : undefined,
        input.spellClass
          ? sql`exists (
              select 1
              from jsonb_array_elements(coalesce(${codexSpells.raw}->'classes', '[]'::jsonb)) as elem
              where lower(elem->>'name') = lower(${input.spellClass})
            )`
          : undefined,
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
            raw: codexSpells.raw,
          })
          .from(codexSpells)
          .where(where)
          .orderBy(...spellOrderBy(input.sortBy, input.sortDir))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(codexSpells).where(where),
      ]);

      return {
        spells: rows.map(({ raw, ...row }) => ({
          ...row,
          ...codexSpellFlags(raw as Record<string, unknown>),
          classes: spellClassesFromRaw(raw as Record<string, unknown>),
        })),
        total: total?.value ?? 0,
      };
    }),

  /** Distinct filter facets (levels + schools) for the sidebar. */
  spellFacets: protectedProcedure.query(async () => {
    const db = getDb();
    const [levels, schools, classSource] = await Promise.all([
      db
        .selectDistinct({ value: codexSpells.level })
        .from(codexSpells)
        .orderBy(asc(codexSpells.level)),
      db
        .selectDistinct({ value: codexSpells.school })
        .from(codexSpells)
        .orderBy(asc(codexSpells.school)),
      db.select({ raw: codexSpells.raw }).from(codexSpells),
    ]);
    const classSet = new Set<string>();
    for (const row of classSource) {
      for (const name of spellClassesFromRaw(row.raw as Record<string, unknown>)) {
        classSet.add(name);
      }
    }
    return {
      levels: levels.map((l) => l.value).filter((v): v is string => v != null),
      schools: schools
        .map((s) => s.value)
        .filter((v): v is string => v != null),
      classes: [...classSet].sort((a, b) => a.localeCompare(b)),
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

  /** SRD subclasses, optionally filtered by parent class. */
  listSubclasses: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          classSlug: z.string().trim().max(80).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input?.search
          ? ilike(codexSubclasses.name, `%${input.search}%`)
          : undefined,
        input?.classSlug
          ? eq(codexSubclasses.classSlug, input.classSlug)
          : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select({
          slug: codexSubclasses.slug,
          name: codexSubclasses.name,
          classSlug: codexSubclasses.classSlug,
          className: codexSubclasses.className,
          pickLevel: codexSubclasses.pickLevel,
          description: codexSubclasses.description,
        })
        .from(codexSubclasses)
        .where(where)
        .orderBy(asc(codexSubclasses.className), asc(codexSubclasses.name));
    }),

  /** Full SRD subclass record by slug. */
  getSubclass: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexSubclasses)
        .where(eq(codexSubclasses.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Resolve subclass by display name (character sheet / wizard). */
  getSubclassByName: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        className: z.string().trim().max(60).optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        ilike(codexSubclasses.name, input.name),
        input.className
          ? eq(codexSubclasses.className, input.className)
          : undefined,
      ].filter(Boolean);
      const [row] = await db
        .select()
        .from(codexSubclasses)
        .where(and(...conditions))
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

  /** Weapon mastery properties for equipped item names (Open5e raw JSON). */
  resolveWeaponMasteries: protectedProcedure
    .input(z.object({ names: z.array(z.string()).max(24) }))
    .query(async ({ input }) => {
      const db = getDb();
      const out: Record<string, { property: string; description: string }> =
        {};
      for (const rawName of input.names) {
        const name = rawName.trim();
        if (!name || out[name]) continue;
        const [row] = await db
          .select({ name: codexItems.name, raw: codexItems.raw })
          .from(codexItems)
          .where(ilike(codexItems.name, name))
          .limit(1);
        if (!row) continue;
        const mastery = masteryFromOpen5eItemRaw(row.raw);
        if (mastery) out[name] = mastery;
      }
      return out;
    }),

  /** Total ingested item count. */
  itemCount: protectedProcedure.query(async () => {
    const db = getDb();
    const [row] = await db.select({ value: count() }).from(codexItems);
    return { count: row?.value ?? 0 };
  }),

  /** Lightweight name/slug index for cross-linking background benefits. */
  linkIndex: protectedProcedure.query(async () => {
    const db = getDb();
    const [feats, items] = await Promise.all([
      db
        .select({
          slug: codexFeats.slug,
          name: codexFeats.name,
          preview: codexFeats.description,
        })
        .from(codexFeats)
        .orderBy(asc(codexFeats.name)),
      db
        .select({
          slug: codexItems.slug,
          name: codexItems.name,
          preview: codexItems.description,
        })
        .from(codexItems)
        .orderBy(asc(codexItems.name)),
    ]);
    return { feats, items };
  }),

  /** SRD backgrounds for the Codex, alphabetical. */
  listBackgrounds: protectedProcedure
    .input(z.object({ search: z.string().trim().max(100).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const where = input?.search
        ? ilike(codexBackgrounds.name, `%${input.search}%`)
        : undefined;
      return db
        .select({
          slug: codexBackgrounds.slug,
          name: codexBackgrounds.name,
          description: codexBackgrounds.description,
          raw: codexBackgrounds.raw,
        })
        .from(codexBackgrounds)
        .where(where)
        .orderBy(asc(codexBackgrounds.name))
        .then((rows) =>
          rows.map(({ raw, ...row }) => ({
            ...row,
            skillSummary: backgroundBenefitSummary(
              raw as Record<string, unknown>,
            ),
            skillProficiencies: backgroundSkillProficiencies(
              raw as Record<string, unknown>,
            ),
            originFeatName: backgroundOriginFeatName(
              raw as Record<string, unknown>,
            ),
          })),
        );
    }),

  getBackgroundByName: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexBackgrounds)
        .where(eq(codexBackgrounds.name, input.name))
        .limit(1);
      if (!row) return null;
      const raw = row.raw as Record<string, unknown>;
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        featureEntries: backgroundFeatureEntries(raw),
        originFeatName: backgroundOriginFeatName(raw),
      };
    }),

  /** Full SRD background record by slug. */
  getBackground: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexBackgrounds)
        .where(eq(codexBackgrounds.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Filterable list of SRD feats. */
  listFeats: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          featType: z.string().trim().max(40).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input?.search
          ? ilike(codexFeats.name, `%${input.search}%`)
          : undefined,
        input?.featType ? eq(codexFeats.featType, input.featType) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select({
          slug: codexFeats.slug,
          name: codexFeats.name,
          description: codexFeats.description,
          prerequisite: codexFeats.prerequisite,
          featType: codexFeats.featType,
        })
        .from(codexFeats)
        .where(where)
        .orderBy(asc(codexFeats.name));
    }),

  /** Distinct feat types for filter chips. */
  featFacets: protectedProcedure.query(async () => {
    const db = getDb();
    const types = await db
      .selectDistinct({ value: codexFeats.featType })
      .from(codexFeats)
      .orderBy(asc(codexFeats.featType));
    return {
      types: types.map((t) => t.value).filter((v): v is string => v != null),
    };
  }),

  /** Full SRD feat record by slug. */
  getFeat: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexFeats)
        .where(eq(codexFeats.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** SRD rules chapters (rulesets), in document order. */
  listRuleChapters: protectedProcedure.query(async () => {
    const db = getDb();
    return db
      .select({
        slug: codexRuleChapters.slug,
        name: codexRuleChapters.name,
        description: codexRuleChapters.description,
      })
      .from(codexRuleChapters)
      .orderBy(asc(codexRuleChapters.sortIndex), asc(codexRuleChapters.name));
  }),

  /** Filterable list of SRD rule sections. */
  listRuleSections: protectedProcedure
    .input(
      z
        .object({
          chapterSlug: z.string().trim().max(120).optional(),
          search: z.string().trim().max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input?.chapterSlug
          ? eq(codexRuleSections.chapterSlug, input.chapterSlug)
          : undefined,
        input?.search
          ? ilike(codexRuleSections.name, `%${input.search}%`)
          : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select({
          slug: codexRuleSections.slug,
          name: codexRuleSections.name,
          description: codexRuleSections.description,
          chapterSlug: codexRuleSections.chapterSlug,
        })
        .from(codexRuleSections)
        .where(where)
        .orderBy(
          asc(codexRuleSections.chapterSlug),
          asc(codexRuleSections.sortIndex),
          asc(codexRuleSections.name),
        );
    }),

  /** Full SRD rule section by slug. */
  getRuleSection: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexRuleSections)
        .where(eq(codexRuleSections.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),

  /** Filterable list of optional / advanced SRD rules. */
  listAdvancedRules: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          topic: z.string().trim().max(40).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        input?.search
          ? ilike(codexAdvancedRules.name, `%${input.search}%`)
          : undefined,
        input?.topic ? eq(codexAdvancedRules.topic, input.topic) : undefined,
      ].filter(Boolean);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select({
          slug: codexAdvancedRules.slug,
          name: codexAdvancedRules.name,
          description: codexAdvancedRules.description,
          topic: codexAdvancedRules.topic,
        })
        .from(codexAdvancedRules)
        .where(where)
        .orderBy(
          asc(codexAdvancedRules.topic),
          asc(codexAdvancedRules.sortIndex),
          asc(codexAdvancedRules.name),
        );
    }),

  /** Distinct advanced rule topics for filter chips. */
  advancedFacets: protectedProcedure.query(async () => {
    const db = getDb();
    const topics = await db
      .selectDistinct({ value: codexAdvancedRules.topic })
      .from(codexAdvancedRules)
      .orderBy(asc(codexAdvancedRules.topic));
    return {
      topics: topics.map((t) => t.value).filter((v): v is string => v != null),
    };
  }),

  /** Full advanced rule record by slug. */
  getAdvancedRule: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(codexAdvancedRules)
        .where(eq(codexAdvancedRules.slug, input.slug))
        .limit(1);
      return row ?? null;
    }),
});
