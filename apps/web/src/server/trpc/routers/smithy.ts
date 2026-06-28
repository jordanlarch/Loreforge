/**
 * Smithy tRPC router — owner-scoped homebrew items (issue #4).
 *
 * First Smithy surface: create / list / get / delete custom items, scoped to the
 * signed-in Supabase user. Item taxonomy (type/rarity/source) is validated
 * against the shared `@app/engine` content constants so the DB, API, and UI
 * never drift. Codex spell copy is live via `copySpellFromCodex` (SMITH-6).
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  codexCopyCategory,
  copyCodexEntryToSmithy,
  copySubclassToSmithy,
  resetHomebrewItemFromCodex,
  resetHomebrewSpellFromCodex,
} from "@/server/lib/copy-codex-to-smithy";
import { assembleItemDefinition } from "@/server/lib/smithy-item-definition";
import {
  assembleToolboxDefinition,
} from "@/server/lib/smithy-toolbox-definition";

import {
  AREA_SHAPES,
  CASTING_TIME_UNITS,
  DAMAGE_TYPES,
  DURATION_UNITS,
  ITEM_RARITIES,
  ITEM_SOURCES,
  ITEM_TYPES,
  RANGE_TYPES,
  SAVE_OUTCOMES,
  SPELL_SCHOOLS,
  TARGETING_TYPES,
  TOOLBOX_TOPICS,
  TRAP_RESET_MODES,
  POISON_TYPES,
  open5eRawToSpellDefinition,
  validateItemDefinition,
  validateSpellDefinition,
  type ItemDefinition,
  type SpellDefinition,
  type GameplayToolboxEntryDefinition,
  type TrapDefinition,
  type ToolboxCheck,
  type ToolboxTopic,
} from "@app/engine";
import {
  codexSpells,
  getDb,
  homebrewItems,
  homebrewSpells,
  homebrewToolboxEntries,
} from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

import {
  SMITHY_LIBRARY_CATEGORIES,
  smithyItemLibraryCategory,
  type SmithyLibraryCategory,
} from "@/lib/smithy-categories";
import { filterSortSmithyLibraryEntries } from "@/lib/smithy-library-filter";
import { formatToolboxTopic } from "@/lib/codex-toolbox-display";

const smithyLibraryCategory = z.enum(SMITHY_LIBRARY_CATEGORIES);
const smithyLibrarySortBy = z.enum(["updatedAt", "name"]);
const smithyLibrarySortDir = z.enum(["asc", "desc"]);

const itemType = z.enum(ITEM_TYPES);
const itemRarity = z.enum(ITEM_RARITIES);
const itemSource = z.enum(ITEM_SOURCES);

const listLibraryInput = z
  .object({
    category: smithyLibraryCategory.optional(),
    itemType: itemType.optional(),
    search: z.string().trim().max(120).optional(),
    source: itemSource.optional(),
    sortBy: smithyLibrarySortBy.optional(),
    sortDir: smithyLibrarySortDir.optional(),
    level: z.number().int().min(0).max(9).optional(),
    school: z.enum(SPELL_SCHOOLS).optional(),
  })
  .optional();

const ABILITY = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const dice = z.string().trim().min(1).max(20);

const itemEquippedEffect = z.object({
  name: z.string().trim().min(1).max(80),
  modifier: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("ac_bonus"),
      amount: z.number().int().min(-5).max(10),
    }),
    z.object({
      type: z.literal("attack_roll_bonus"),
      amount: z.number().int().min(-5).max(10),
    }),
    z.object({
      type: z.literal("on_hit_damage"),
      dice,
      damageType: z.enum(DAMAGE_TYPES),
    }),
  ]),
});

const itemMechanicsInput = z.object({
  weapon: z
    .object({
      damage: z.object({ dice, type: z.enum(DAMAGE_TYPES) }),
      attackBonus: z.number().int().min(-5).max(10).optional(),
      finesse: z.boolean().optional(),
      ranged: z.boolean().optional(),
      rangeFt: z.number().int().min(5).max(600).optional(),
      mastery: z.string().trim().max(40).optional(),
    })
    .optional(),
  armor: z
    .object({
      baseAc: z.number().int().min(10).max(30),
      dexBonusMax: z.number().int().min(0).max(5).nullable().optional(),
      stealthDisadvantage: z.boolean().optional(),
      shield: z.boolean().optional(),
    })
    .optional(),
  equippedEffects: z.array(itemEquippedEffect).max(6).optional(),
  propertyDetails: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(500).optional(),
        detail: z.string().trim().max(120).nullable().optional(),
        mastery: z.boolean().optional(),
      }),
    )
    .max(20)
    .optional(),
});

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: itemType,
  rarity: itemRarity.default("Common"),
  properties: z.array(z.string().trim().max(60)).max(20).default([]),
  description: z.string().trim().max(4000).default(""),
  requiresAttunement: z.boolean().default(false),
  source: itemSource.default("original"),
  copiedFromSlug: z.string().trim().max(160).optional(),
  mechanics: itemMechanicsInput.optional(),
});

/**
 * Wire-level validation of a declarative spell. Enum/field shape is enforced
 * here; the assembled {@link SpellDefinition} is then run through the engine's
 * `validateSpellDefinition` (the authoritative cross-field gate) before insert.
 */
const createSpellInput = z.object({
  name: z.string().trim().min(1).max(120),
  level: z.number().int().min(0).max(9),
  school: z.enum(SPELL_SCHOOLS),
  classes: z.array(z.string().trim().max(40)).max(12).default([]),
  castingTime: z.object({
    unit: z.enum(CASTING_TIME_UNITS),
    amount: z.number().int().min(1).max(24).default(1),
  }),
  range: z.object({
    type: z.enum(RANGE_TYPES),
    amount: z.number().int().min(0).max(100000).optional(),
    area: z
      .object({
        shape: z.enum(AREA_SHAPES),
        size: z.number().int().min(1).max(1000),
      })
      .optional(),
  }),
  components: z.object({
    verbal: z.boolean().default(false),
    somatic: z.boolean().default(false),
    material: z.string().trim().max(300).optional(),
  }),
  duration: z.object({
    unit: z.enum(DURATION_UNITS),
    amount: z.number().int().min(1).max(10000).optional(),
  }),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  targeting: z.enum(TARGETING_TYPES),
  saveAgainst: z
    .object({
      ability: ABILITY,
      dc: z.union([z.literal("spellsave"), z.number().int().min(1).max(40)]),
      onSuccess: z.enum(SAVE_OUTCOMES),
    })
    .optional(),
  attackAgainst: z.object({ type: z.enum(["melee", "ranged"]) }).optional(),
  damage: z
    .array(z.object({ dice, type: z.enum(DAMAGE_TYPES) }))
    .max(6)
    .optional(),
  healing: z.object({ dice }).optional(),
  upcastScaling: z
    .object({
      perSlotDice: dice,
      appliesTo: z.enum(["damage", "healing"]),
    })
    .optional(),
  description: z.string().trim().max(4000).default(""),
  source: itemSource.default("original"),
  copiedFromSlug: z.string().trim().max(160).optional(),
});

const toolboxCheckInput = z.object({
  dc: z.number().int().min(1).max(30),
  ability: ABILITY,
  skill: z.string().trim().max(60).optional(),
  tool: z.string().trim().max(60).optional(),
});

const TOOLBOX_SAVE_OUTCOMES = ["none", "half", "negates"] as const;

const trapEffectInput = z.object({
  save: z
    .object({
      ability: ABILITY,
      dc: z.number().int().min(1).max(30),
      onSuccess: z.enum(TOOLBOX_SAVE_OUTCOMES),
    })
    .optional(),
  damage: z
    .array(z.object({ dice, type: z.enum(DAMAGE_TYPES) }))
    .max(6)
    .optional(),
  conditions: z.array(z.string().trim().max(60)).max(10).optional(),
  effectProse: z.string().trim().max(2000).optional(),
});

const toolboxTrapInput = z.object({
  trigger: z.string().trim().min(1).max(500),
  effect: trapEffectInput,
  detect: toolboxCheckInput.optional(),
  disable: toolboxCheckInput.optional(),
  reset: z.enum(TRAP_RESET_MODES),
  resetInterval: z.string().trim().max(80).optional(),
});

const toolboxPoisonInput = z.object({
  poisonType: z.enum(POISON_TYPES),
  save: z
    .object({
      ability: ABILITY,
      dc: z.number().int().min(1).max(30),
      onSuccess: z.enum(TOOLBOX_SAVE_OUTCOMES),
    })
    .optional(),
  damage: z
    .array(z.object({ dice, type: z.enum(DAMAGE_TYPES) }))
    .max(6)
    .optional(),
  conditions: z.array(z.string().trim().max(60)).max(10).optional(),
  repeat: z.string().trim().max(500).optional(),
});

const toolboxCurseInput = z.object({
  contagion: z.string().trim().max(1000).optional(),
  save: z
    .object({
      ability: ABILITY,
      dc: z.number().int().min(1).max(30),
      onSuccess: z.enum(TOOLBOX_SAVE_OUTCOMES),
    })
    .optional(),
  effects: z.array(z.string().trim().max(500)).max(12).optional(),
  recovery: z.string().trim().max(1000).optional(),
});

const createToolboxInput = z.object({
  name: z.string().trim().min(1).max(120),
  topic: z.enum(TOOLBOX_TOPICS).default("trap"),
  description: z.string().trim().max(4000).default(""),
  source: itemSource.default("original"),
  copiedFromSlug: z.string().trim().max(160).optional(),
  trap: toolboxTrapInput.optional(),
  poison: toolboxPoisonInput.optional(),
  curse: toolboxCurseInput.optional(),
});

function toolboxDefinitionFromInput(
  input: z.infer<typeof createToolboxInput>,
): GameplayToolboxEntryDefinition {
  return assembleToolboxDefinition({
    topic: input.topic,
    trap: input.trap
      ? {
          name: input.name,
          description: input.description,
          trigger: input.trap.trigger,
          effect: input.trap.effect,
          detect: input.trap.detect,
          disable: input.trap.disable,
          reset: input.trap.reset,
          resetInterval: input.trap.resetInterval,
        }
      : undefined,
    poison: input.poison
      ? {
          name: input.name,
          description: input.description,
          poisonType: input.poison.poisonType,
          save: input.poison.save,
          damage: input.poison.damage,
          conditions: input.poison.conditions,
          repeat: input.poison.repeat,
        }
      : undefined,
    curse: input.curse
      ? {
          name: input.name,
          description: input.description,
          contagion: input.curse.contagion,
          save: input.curse.save,
          effects: input.curse.effects,
          recovery: input.curse.recovery,
        }
      : undefined,
  });
}

/** Deterministic slug for the spell id from its name (id is engine-facing). */
function spellId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "spell"
  );
}

function itemDefinitionFromInput(
  input: z.infer<typeof createInput>,
  existing?: ItemDefinition,
): ItemDefinition {
  const definition = assembleItemDefinition({
    name: input.name,
    type: input.type,
    description: input.description,
    mechanics: input.mechanics,
    existing,
  });
  const errors = validateItemDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }
  return definition;
}

export const smithyRouter = createTRPCRouter({
  /**
   * Unified homebrew library for the Smithy landing (SMITH-2).
   * Merges typed items + spells; optional category filter mirrors Codex IA.
   */
  listLibrary: protectedProcedure
    .input(listLibraryInput)
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const category = input?.category ?? "All";

      const [items, spells, toolboxEntries] = await Promise.all([
        db
          .select()
          .from(homebrewItems)
          .where(eq(homebrewItems.ownerId, ctx.user.id))
          .orderBy(desc(homebrewItems.updatedAt)),
        db
          .select({
            id: homebrewSpells.id,
            name: homebrewSpells.name,
            level: homebrewSpells.level,
            school: homebrewSpells.school,
            source: homebrewSpells.source,
            updatedAt: homebrewSpells.updatedAt,
            description: homebrewSpells.description,
          })
          .from(homebrewSpells)
          .where(eq(homebrewSpells.ownerId, ctx.user.id))
          .orderBy(desc(homebrewSpells.updatedAt)),
        db
          .select({
            id: homebrewToolboxEntries.id,
            name: homebrewToolboxEntries.name,
            topic: homebrewToolboxEntries.topic,
            source: homebrewToolboxEntries.source,
            updatedAt: homebrewToolboxEntries.updatedAt,
            description: homebrewToolboxEntries.description,
          })
          .from(homebrewToolboxEntries)
          .where(eq(homebrewToolboxEntries.ownerId, ctx.user.id))
          .orderBy(desc(homebrewToolboxEntries.updatedAt)),
      ]);

      type Entry = {
        kind: "item" | "spell" | "toolbox";
        id: string;
        name: string;
        source: (typeof items)[number]["source"];
        category: SmithyLibraryCategory;
        subtitle: string;
        href: string;
        updatedAt: Date;
        descriptionSnippet: string | null;
        rarity?: string | null;
      };

      const entries: Entry[] = [];

      for (const item of items) {
        const itemCategory = smithyItemLibraryCategory(item);
        if (itemCategory == null) {
          if (category !== "All") continue;
        } else if (category !== "All" && category !== itemCategory) {
          continue;
        }
        if (input?.itemType && item.type !== input.itemType) continue;

        entries.push({
          kind: "item",
          id: item.id,
          name: item.name,
          source: item.source,
          category: itemCategory ?? "Items",
          subtitle: `${item.type} · ${item.rarity}`,
          href: `/smithy/${item.id}`,
          updatedAt: item.updatedAt,
          descriptionSnippet: item.description.trim().slice(0, 120) || null,
          rarity: item.rarity,
        });
      }

      for (const spell of spells) {
        if (category !== "All" && category !== "Spells") continue;
        if (input?.level != null && spell.level !== input.level) continue;
        if (input?.school && spell.school !== input.school) continue;
        entries.push({
          kind: "spell",
          id: spell.id,
          name: spell.name,
          source: spell.source,
          category: "Spells",
          subtitle: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · ${spell.school}`,
          href: `/smithy/spells/${spell.id}`,
          updatedAt: spell.updatedAt,
          descriptionSnippet: spell.description.trim().slice(0, 120) || null,
        });
      }

      for (const row of toolboxEntries) {
        if (category !== "All" && category !== "Toolbox") continue;
        entries.push({
          kind: "toolbox",
          id: row.id,
          name: row.name,
          source: row.source,
          category: "Toolbox",
          subtitle: formatToolboxTopic(row.topic),
          href: `/smithy/toolbox/${row.id}`,
          updatedAt: row.updatedAt,
          descriptionSnippet: row.description.trim().slice(0, 120) || null,
        });
      }

      return filterSortSmithyLibraryEntries(entries, {
        search: input?.search,
        source: input?.source,
        sortBy: input?.sortBy,
        sortDir: input?.sortDir,
      });
    }),

  /** Homebrew items owned by the current user, newest first, optional type filter. */
  list: protectedProcedure
    .input(z.object({ type: itemType.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [
        eq(homebrewItems.ownerId, ctx.user.id),
        input?.type ? eq(homebrewItems.type, input.type) : undefined,
      ].filter(Boolean);
      return db
        .select()
        .from(homebrewItems)
        .where(and(...conditions))
        .orderBy(desc(homebrewItems.createdAt));
    }),

  /** Single owned item, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, input.id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Batch-resolve Smithy item definitions for sheet loadout / AC (DATA-1a). */
  resolveItemDefinitions: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(40) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return {} as Record<string, ItemDefinition>;
      const db = getDb();
      const rows = await db
        .select({
          id: homebrewItems.id,
          definition: homebrewItems.definition,
        })
        .from(homebrewItems)
        .where(
          and(
            eq(homebrewItems.ownerId, ctx.user.id),
            inArray(homebrewItems.id, input.ids),
          ),
        );
      return Object.fromEntries(
        rows.map((row) => [row.id, row.definition]),
      ) as Record<string, ItemDefinition>;
    }),

  /** Forge a new homebrew item owned by the current user. */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { mechanics: _mechanics, ...rowInput } = input;
      const definition = itemDefinitionFromInput(input);
      const [row] = await db
        .insert(homebrewItems)
        .values({ ...rowInput, definition, ownerId: ctx.user.id })
        .returning();
      return row;
    }),

  /** Update an owned homebrew item (SMITH-1). */
  update: protectedProcedure
    .input(createInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, mechanics: _mechanics, ...patch } = input;
      const [existing] = await db
        .select({ definition: homebrewItems.definition })
        .from(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      const definition = itemDefinitionFromInput(input, existing.definition);
      const [row] = await db
        .update(homebrewItems)
        .set({ ...patch, definition, updatedAt: new Date() })
        .where(
          and(
            eq(homebrewItems.id, id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      return row;
    }),

  /** Duplicate an owned homebrew item as "(Copy)". */
  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [source] = await db
        .select()
        .from(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, input.id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }

      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rest
      } = source;
      const [row] = await db
        .insert(homebrewItems)
        .values({
          ...rest,
          name: `${source.name} (Copy)`,
          ownerId: ctx.user.id,
        })
        .returning();
      return row;
    }),

  /** Delete an owned item. Throws NOT_FOUND if it doesn't exist / isn't owned. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .delete(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, input.id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: homebrewItems.id });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      return { id: row.id };
    }),

  /** Homebrew spells owned by the current user, with optional level/school filter. */
  listSpells: protectedProcedure
    .input(
      z
        .object({
          level: z.number().int().min(0).max(9).optional(),
          school: z.enum(SPELL_SCHOOLS).optional(),
          search: z.string().trim().max(120).optional(),
          source: itemSource.optional(),
          sortBy: smithyLibrarySortBy.optional(),
          sortDir: smithyLibrarySortDir.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [
        eq(homebrewSpells.ownerId, ctx.user.id),
        input?.level != null ? eq(homebrewSpells.level, input.level) : undefined,
        input?.school ? eq(homebrewSpells.school, input.school) : undefined,
      ].filter(Boolean);
      const rows = await db
        .select({
          id: homebrewSpells.id,
          name: homebrewSpells.name,
          level: homebrewSpells.level,
          school: homebrewSpells.school,
          source: homebrewSpells.source,
          updatedAt: homebrewSpells.updatedAt,
          description: homebrewSpells.description,
        })
        .from(homebrewSpells)
        .where(and(...conditions))
        .orderBy(asc(homebrewSpells.level), asc(homebrewSpells.name));

      const mapped = rows.map((spell) => ({
        ...spell,
        descriptionSnippet: spell.description.trim().slice(0, 120) || null,
      }));

      return filterSortSmithyLibraryEntries(mapped, {
        search: input?.search,
        source: input?.source,
        sortBy: input?.sortBy,
        sortDir: input?.sortDir,
      }).map(({ descriptionSnippet: _snippet, ...spell }) => spell);
    }),

  /** Single owned spell, or null if missing / not owned. */
  getSpell: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(homebrewSpells)
        .where(
          and(
            eq(homebrewSpells.id, input.id),
            eq(homebrewSpells.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  /**
   * Inscribe a new declarative homebrew spell. The wire input is validated by
   * zod, assembled into a `SpellDefinition`, then gated by the engine's
   * `validateSpellDefinition` so every stored row satisfies the engine contract.
   */
  createSpell: protectedProcedure
    .input(createSpellInput)
    .mutation(async ({ ctx, input }) => {
      const definition: SpellDefinition = {
        id: spellId(input.name),
        name: input.name,
        level: input.level as SpellDefinition["level"],
        school: input.school,
        classes: input.classes,
        castingTime: input.castingTime,
        range: input.range,
        components: input.components,
        duration: input.duration,
        concentration: input.concentration,
        ritual: input.ritual,
        targeting: input.targeting,
        saveAgainst: input.saveAgainst,
        attackAgainst: input.attackAgainst,
        damage: input.damage,
        healing: input.healing,
        upcastScaling: input.upcastScaling,
        description: input.description,
      };

      const errors = validateSpellDefinition(definition);
      if (errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.join(" "),
        });
      }

      const db = getDb();
      const [row] = await db
        .insert(homebrewSpells)
        .values({
          ownerId: ctx.user.id,
          name: definition.name,
          level: definition.level,
          school: definition.school,
          description: definition.description,
          definition,
          source: input.source,
          copiedFromSlug: input.copiedFromSlug,
        })
        .returning();
      return row;
    }),

  /** Update an existing homebrew spell (SMITH-1). */
  updateSpell: protectedProcedure
    .input(
      createSpellInput.extend({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const definition: SpellDefinition = {
        id: spellId(input.name),
        name: input.name,
        level: input.level as SpellDefinition["level"],
        school: input.school,
        classes: input.classes,
        castingTime: input.castingTime,
        range: input.range,
        components: input.components,
        duration: input.duration,
        concentration: input.concentration,
        ritual: input.ritual,
        targeting: input.targeting,
        saveAgainst: input.saveAgainst,
        attackAgainst: input.attackAgainst,
        damage: input.damage,
        healing: input.healing,
        upcastScaling: input.upcastScaling,
        description: input.description,
      };

      const errors = validateSpellDefinition(definition);
      if (errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errors.join(" "),
        });
      }

      const db = getDb();
      const [row] = await db
        .update(homebrewSpells)
        .set({
          name: definition.name,
          level: definition.level,
          school: definition.school,
          description: definition.description,
          definition,
          source: input.source,
          copiedFromSlug: input.copiedFromSlug,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(homebrewSpells.id, input.id),
            eq(homebrewSpells.ownerId, ctx.user.id),
          ),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Spell not found." });
      }
      return row;
    }),

  /**
   * Copy an ingested Codex spell into the owner's Smithy grimoire (CODEX-2 /
   * SMITH-6). Idempotent per owner+slug — returns the existing homebrew row if
   * already copied. Open5e raw → {@link SpellDefinition} is best-effort; spells
   * that fail engine validation return BAD_REQUEST.
   */
  copySpellFromCodex: protectedProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(160) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [existing] = await db
        .select()
        .from(homebrewSpells)
        .where(
          and(
            eq(homebrewSpells.ownerId, ctx.user.id),
            eq(homebrewSpells.copiedFromSlug, input.slug),
          ),
        )
        .limit(1);
      if (existing) return existing;

      const [codex] = await db
        .select()
        .from(codexSpells)
        .where(eq(codexSpells.slug, input.slug))
        .limit(1);
      if (!codex) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Codex spell not found.",
        });
      }

      const definition = open5eRawToSpellDefinition(codex.raw, {
        slug: codex.slug,
        name: codex.name,
      });
      const errors = validateSpellDefinition(definition);
      if (errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This spell could not be converted automatically: ${errors.join(" ")}`,
        });
      }

      const [row] = await db
        .insert(homebrewSpells)
        .values({
          ownerId: ctx.user.id,
          name: definition.name,
          level: definition.level,
          school: definition.school,
          description: definition.description,
          definition,
          source: "codex",
          copiedFromSlug: input.slug,
        })
        .returning();
      return row;
    }),

  /**
   * Copy any Codex entry into the Smithy (CODEX A4). Spells become grimoire rows;
   * items map to typed homebrew items; other categories become editable text snapshots.
   */
  copyFromCodex: protectedProcedure
    .input(
      z.object({
        category: z.enum(codexCopyCategory),
        slug: z.string().trim().min(1).max(160),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      copyCodexEntryToSmithy({
        ownerId: ctx.user.id,
        category: input.category,
        slug: input.slug,
      }),
    ),

  /** Copy a Codex subclass into the Smithy as a typed snapshot row. */
  copySubclassFromCodex: protectedProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(160) }))
    .mutation(async ({ ctx, input }) =>
      copySubclassToSmithy({
        ownerId: ctx.user.id,
        slug: input.slug,
      }),
    ),

  /** Reset a Codex-copied homebrew row to the current SRD source (SMITH-6). */
  resetFromCodex: protectedProcedure
    .input(
      z.object({
        kind: z.enum(["spell", "item"]),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === "spell") {
        return resetHomebrewSpellFromCodex({
          ownerId: ctx.user.id,
          spellId: input.id,
        });
      }
      return resetHomebrewItemFromCodex({
        ownerId: ctx.user.id,
        itemId: input.id,
      });
    }),

  /** Duplicate an owned homebrew spell as "(Copy)". */
  duplicateSpell: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [source] = await db
        .select()
        .from(homebrewSpells)
        .where(
          and(
            eq(homebrewSpells.id, input.id),
            eq(homebrewSpells.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Spell not found." });
      }

      const copyName = `${source.name} (Copy)`;
      const definition: SpellDefinition = {
        ...source.definition,
        id: spellId(copyName),
        name: copyName,
      };

      const [row] = await db
        .insert(homebrewSpells)
        .values({
          ownerId: ctx.user.id,
          name: copyName,
          level: source.level,
          school: source.school,
          description: source.description,
          definition,
          source: source.source,
          copiedFromSlug: source.copiedFromSlug,
        })
        .returning();
      return row;
    }),

  /** Delete an owned spell. Throws NOT_FOUND if it doesn't exist / isn't owned. */
  deleteSpell: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .delete(homebrewSpells)
        .where(
          and(
            eq(homebrewSpells.id, input.id),
            eq(homebrewSpells.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: homebrewSpells.id });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Spell not found." });
      }
      return { id: row.id };
    }),

  getToolboxEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(homebrewToolboxEntries)
        .where(
          and(
            eq(homebrewToolboxEntries.id, input.id),
            eq(homebrewToolboxEntries.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  createToolboxEntry: protectedProcedure
    .input(createToolboxInput)
    .mutation(async ({ ctx, input }) => {
      const definition = toolboxDefinitionFromInput(input);
      const db = getDb();
      const [row] = await db
        .insert(homebrewToolboxEntries)
        .values({
          ownerId: ctx.user.id,
          name: input.name,
          topic: input.topic,
          description: input.description,
          definition,
          source: input.source,
          copiedFromSlug: input.copiedFromSlug,
        })
        .returning();
      return row!;
    }),

  updateToolboxEntry: protectedProcedure
    .input(createToolboxInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const definition = toolboxDefinitionFromInput(input);
      const db = getDb();
      const [row] = await db
        .update(homebrewToolboxEntries)
        .set({
          name: input.name,
          topic: input.topic,
          description: input.description,
          definition,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(homebrewToolboxEntries.id, input.id),
            eq(homebrewToolboxEntries.ownerId, ctx.user.id),
          ),
        )
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Toolbox entry not found.",
        });
      }
      return row;
    }),

  deleteToolboxEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .delete(homebrewToolboxEntries)
        .where(
          and(
            eq(homebrewToolboxEntries.id, input.id),
            eq(homebrewToolboxEntries.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: homebrewToolboxEntries.id });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Toolbox entry not found.",
        });
      }
      return { id: row.id };
    }),
});
