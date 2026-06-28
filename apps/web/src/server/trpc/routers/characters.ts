/**
 * Characters tRPC router — persistent, owner-scoped player characters
 * (issue #3). Replaces the fixture-only sheet: create / get / list back the
 * Characters surfaces with real DB rows. Derived sheet values (mods,
 * proficiency, saves, skills) are still computed via `@app/engine`, never here.
 *
 * The Creation Wizard (#6) and inline edit (#7) build on this surface.
 */
import {
  abilityModifier,
  applyAsi,
  featMeetsPrerequisite,
  fightingStylePickLevel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  isValidAsiChoice,
  levelUpSeed,
  maxHpAtFirstLevel,
  multiclassEligible,
  sheetSlotPoolsFromClasses,
  subclassPickLevel,
  totalLevel,
  warlockLevelFromClasses,
  warlockPactMagic,
  xpForLevel,
  xpProgress,
  createSeededRng,
  effectiveMaxHpFromFeats,
  featureUseSeedStable,
  useClassFeature,
  type AsiChoice,
  type HpMethod,
} from "@app/engine";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  campaignCharacters,
  campaignInvites,
  campaigns,
  characters,
  codexClasses,
  codexFeats,
  getDb,
} from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";
import {
  grantCampaignPartyXp,
  grantCharacterXp,
} from "../../characters-xp";
import {
  createAdminClient,
  isAllowedPortraitType,
  PORTRAIT_BUCKET,
} from "@/lib/supabase/admin";
import {
  parseCharacterNotes,
  serializeCharacterNotes,
} from "@/lib/character-sheet-storage";
import type { SpellLoadout } from "@/lib/character";

/** Hard 5E ceiling for a single class and for total character level. */
const MAX_LEVEL = 20;

const ABILITY = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const asiChoiceInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("increase"),
    ability: ABILITY,
    amount: z.literal(2),
  }),
  z.object({
    mode: z.literal("split"),
    first: ABILITY,
    second: ABILITY,
  }),
]);

const abilityScores = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

const classLevel = z.object({
  class: z.string().trim().min(1).max(60),
  level: z.number().int().min(1).max(20),
  subclass: z.string().trim().max(60).optional(),
});

// Nested fields are required (not `.default()`-ed): an item always has a
// quantity + equipped flag and a spell always has a prepared flag. Keeping the
// input shape identical to the output shape lets the optimistic cache update
// merge mutation variables into the strictly-typed row without divergence.

/** One inventory/equipment entry (#56, rich shape). */
const equipmentItem = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(0).max(100_000),
  equipped: z.boolean(),
  slot: z.string().trim().max(40).optional(),
  smithyItemId: z.string().uuid().optional(),
  weight: z.number().min(0).max(100_000).optional(),
  rarity: z.string().trim().max(40).optional(),
  attunement: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
});

/** A spell on the character's list; `prepared` separates known vs prepared. */
const characterSpell = z.object({
  name: z.string().trim().min(1).max(120),
  level: z.number().int().min(0).max(9),
  prepared: z.boolean(),
  alwaysPrepared: z.boolean().optional(),
  source: z.string().trim().max(80).optional(),
  concentration: z.boolean().optional(),
  ritual: z.boolean().optional(),
  codexSlug: z.string().trim().max(120).optional(),
});

/** Unified spell loadout: one list + per-level slot pools keyed "1".."9". */
const spellLoadout = z.object({
  spells: z.array(characterSpell).max(500),
  slots: z.record(
    z.string(),
    z.object({
      max: z.number().int().min(0).max(99),
      used: z.number().int().min(0).max(99),
    }),
  ),
});

/**
 * Field validators shared by `create` and `update` so the inline-edit gate (#7)
 * enforces exactly the same rules as creation. `create` layers defaults on the
 * optional-on-the-wire fields; `update` reuses these verbatim as a partial.
 */
const characterFields = {
  name: z.string().trim().min(1).max(120),
  species: z.string().trim().max(80),
  background: z.string().trim().max(80),
  classes: z.array(classLevel).min(1).max(10),
  abilityScores,
  maxHp: z.number().int().min(1).max(1000),
  baseAc: z.number().int().min(1).max(40),
  speed: z.number().int().min(0).max(200),
  saveProficiencies: z.array(ABILITY).max(6),
  skillProficiencies: z.array(z.string().trim().max(40)).max(30),
  xp: z.number().int().min(0).max(10_000_000),
  portraitUrl: z.string().trim().max(2000),
  notes: z.string().trim().max(20_000),
  equipment: z.array(equipmentItem).max(500),
  spells: spellLoadout,
} as const;

const createInput = z.object({
  ...characterFields,
  species: characterFields.species.default(""),
  background: characterFields.background.default(""),
  speed: characterFields.speed.default(30),
  saveProficiencies: characterFields.saveProficiencies.default([]),
  skillProficiencies: characterFields.skillProficiencies.default([]),
  xp: characterFields.xp.default(0),
  portraitUrl: characterFields.portraitUrl.default(""),
  notes: characterFields.notes.default(""),
  equipment: characterFields.equipment.default([]),
  spells: characterFields.spells.default({ spells: [], slots: {} }),
});

const updatePatch = z.object(characterFields).partial();

const updateInput = z
  .object({ id: z.string().uuid() })
  .merge(updatePatch)
  .refine((input) => Object.keys(input).some((key) => key !== "id"), {
    message: "No fields to update.",
  });

export const charactersRouter = createTRPCRouter({
  /** Characters in the owner's library (My Characters tab), newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.ownerId, ctx.user.id),
          eq(characters.libraryVisibility, "library"),
        ),
      )
      .orderBy(desc(characters.createdAt), asc(characters.name));
  }),

  /**
   * Library characters plus campaign memberships for the dashboard (#85 / CHAR-3).
   */
  listDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.ownerId, ctx.user.id),
          eq(characters.libraryVisibility, "library"),
        ),
      )
      .orderBy(desc(characters.updatedAt), asc(characters.name));

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const memberships = await db
      .select({
        characterId: campaignCharacters.characterId,
        campaignId: campaigns.id,
        name: campaigns.name,
        role: campaignCharacters.role,
        status: campaignCharacters.status,
        joinedAt: campaignCharacters.joinedAt,
      })
      .from(campaignCharacters)
      .innerJoin(campaigns, eq(campaigns.id, campaignCharacters.campaignId))
      .where(
        and(
          eq(campaignCharacters.ownerId, ctx.user.id),
          inArray(campaignCharacters.characterId, ids),
        ),
      )
      .orderBy(desc(campaignCharacters.joinedAt));

    const byCharacter = new Map<
      string,
      (typeof memberships)[number][]
    >();
    for (const row of memberships) {
      const list = byCharacter.get(row.characterId) ?? [];
      list.push(row);
      byCharacter.set(row.characterId, list);
    }

    return rows.map((character) => ({
      character,
      campaigns: byCharacter.get(character.id) ?? [],
    }));
  }),

  /** Duplicate an owned character into the library as "(Copy)". */
  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [source] = await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rest
      } = source;
      const [row] = await db
        .insert(characters)
        .values({
          ...rest,
          name: `${source.name} (Copy)`,
          ownerId: ctx.user.id,
        })
        .returning();
      return row;
    }),

  /** Single owned character, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Create a character owned by the current user. */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .insert(characters)
        .values({ ...input, ownerId: ctx.user.id })
        .returning();
      return row;
    }),

  /**
   * Patch raw fields on an owned character (inline edit, #7). Only the provided
   * columns change; derived values are still recomputed downstream via
   * `@app/engine`, never here. Invalid edits are rejected by `updateInput`.
   */
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...patch } = input;
      const [row] = await db
        .update(characters)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(characters.id, id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }
      return row;
    }),

  /**
   * Advance one class by a single level (#11 scaffolding). The engine owns the
   * math: HP gain comes from `hpGainOnLevelUp` (average or a seeded roll — never
   * `Math.random`), and the hit die is resolved server-side from the Codex by
   * matching the stored class display name, so the app layer never computes
   * mechanics. Increments the chosen class's level and adds the HP gain to
   * `maxHp`. Feature/ASI choices are surfaced as stubs in the UI; nothing here
   * applies ASI when the new level grants one. Rejects past level 20 (per-class and total).
   */
  levelUp: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        classIndex: z.number().int().min(0).default(0),
        hpMethod: z.enum(["average", "roll"]),
        asi: asiChoiceInput.optional(),
        feat: z.string().trim().max(120).optional(),
        subclass: z.string().trim().max(80).optional(),
        /** Take first level in a new class (multiclass). Ignores classIndex increment. */
        addNewClass: z.string().trim().max(60).optional(),
        milestone: z.boolean().optional(),
        /** Sync SRD slot maxima from class levels after level-up. */
        applySpellSlots: z.boolean().optional(),
        /** Fighting style when this level grants the pick. */
        fightingStyle: z.string().trim().max(40).optional(),
        /** Ranger Favored Enemy / Natural Explorer when first gaining them. */
        featureChoices: z.record(z.string(), z.string()).optional(),
        /** Spells to append to the character spellbook during level-up. */
        addedSpells: z.array(characterSpell).max(24).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [character] = await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      const classes = character.classes;
      const parsedNotes = parseCharacterNotes(character.notes);
      const milestone =
        input.milestone ?? parsedNotes.meta.milestoneXp ?? false;

      const addingClass = Boolean(input.addNewClass?.trim());
      const target = addingClass ? null : classes[input.classIndex];
      if (!addingClass && !target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No such class on this character.",
        });
      }

      if (!addingClass && target!.level >= MAX_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${target!.class} is already at level ${MAX_LEVEL}.`,
        });
      }
      if (totalLevel(classes) >= MAX_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Character is already at the level ${MAX_LEVEL} cap.`,
        });
      }

      const currentTotalLevel = totalLevel(classes);
      if (!milestone) {
        const xpGate = xpProgress(character.xp, currentTotalLevel);
        if (!xpGate.canLevelUp) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              xpGate.remaining != null
                ? `Need ${xpGate.remaining.toLocaleString()} more XP to level up.`
                : "Character cannot level up further.",
          });
        }
      }

      if (addingClass) {
        const primary = classes[0];
        if (!primary || primary.level < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Multiclass requires at least 2 levels in your first class.",
          });
        }
        if (classes.some((c) => c.class === input.addNewClass)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Already has levels in ${input.addNewClass}.`,
          });
        }
        const prospective = [
          ...classes.map((c) => c.class),
          input.addNewClass!,
        ];
        if (!multiclassEligible(prospective, character.abilityScores)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Ability scores do not meet SRD multiclass prerequisites for one or more classes.",
          });
        }
      }

      const classNameForDie = addingClass
        ? input.addNewClass!
        : target!.class;

      const [klass] = await db
        .select({ hitDie: codexClasses.hitDie })
        .from(codexClasses)
        .where(eq(codexClasses.name, classNameForDie))
        .limit(1);

      if (!klass) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't determine the hit die for "${classNameForDie}". Level-up needs an SRD class.`,
        });
      }

      const newClassLevel = addingClass ? 1 : target!.level + 1;
      const newTotalLevel = totalLevel(classes) + 1;

      const needsSubclassPick =
        subclassPickLevel(classNameForDie) === newClassLevel;
      if (needsSubclassPick && !input.subclass?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This level requires a subclass choice.",
        });
      }

      const grantsAsi =
        !addingClass && grantsAsiAtLevel(target!.class, newClassLevel);
      if (grantsAsi && !input.asi && !input.feat?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This level grants an ASI — choose ability scores or take a feat.",
        });
      }
      if (input.asi && input.feat?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose either an ASI or a feat, not both.",
        });
      }
      if (input.asi && !grantsAsi) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This level does not grant an Ability Score Improvement.",
        });
      }
      if (input.feat?.trim() && !grantsAsi) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This level does not grant a feat choice.",
        });
      }

      let nextScores = character.abilityScores;
      if (input.asi) {
        const choice = input.asi as AsiChoice;
        if (!isValidAsiChoice(character.abilityScores, choice)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid ASI choice (abilities cannot exceed 20).",
          });
        }
        nextScores = applyAsi(character.abilityScores, choice);
      }

      if (input.feat?.trim()) {
        const [featRow] = await db
          .select({ prerequisite: codexFeats.prerequisite })
          .from(codexFeats)
          .where(ilike(codexFeats.name, input.feat.trim()))
          .limit(1);
        if (
          featRow &&
          !featMeetsPrerequisite(featRow.prerequisite, {
            characterLevel: newTotalLevel,
            abilityScores: nextScores,
          })
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Feat prerequisites not met: ${featRow.prerequisite ?? input.feat.trim()}.`,
          });
        }
      }

      const conMod = abilityModifier(nextScores.con);
      const method: HpMethod = input.hpMethod;
      const hpGain = addingClass
        ? maxHpAtFirstLevel(klass.hitDie, nextScores.con)
        : hpGainOnLevelUp(klass.hitDie, conMod, {
            mode: method,
            rng:
              method === "roll"
                ? createSeededRng(levelUpSeed(character.id, newTotalLevel))
                : undefined,
          });

      const nextClasses = addingClass
        ? [
            ...classes,
            {
              class: input.addNewClass!,
              level: 1,
              ...(input.subclass?.trim() &&
              subclassPickLevel(input.addNewClass!) === 1
                ? { subclass: input.subclass.trim() }
                : {}),
            },
          ]
        : classes.map((c, i) => {
            if (i !== input.classIndex) return c;
            const patch: { class: string; level: number; subclass?: string } = {
              ...c,
              level: newClassLevel,
            };
            if (
              input.subclass?.trim() &&
              subclassPickLevel(c.class) === newClassLevel
            ) {
              patch.subclass = input.subclass.trim();
            }
            return patch;
          });

      let nextMeta = { ...parsedNotes.meta };
      if (input.feat?.trim()) {
        nextMeta = {
          ...nextMeta,
          feats: [...(nextMeta.feats ?? []), input.feat.trim()],
        };
      }
      if (
        input.fightingStyle?.trim() &&
        fightingStylePickLevel(classNameForDie) === newClassLevel
      ) {
        nextMeta = {
          ...nextMeta,
          fightingStyles: {
            ...(nextMeta.fightingStyles ?? {}),
            [classNameForDie]: input.fightingStyle.trim(),
          },
        };
      }
      if (input.featureChoices && Object.keys(input.featureChoices).length > 0) {
        nextMeta = {
          ...nextMeta,
          featureChoices: {
            ...(nextMeta.featureChoices ?? {}),
            ...input.featureChoices,
          },
        };
      }

      const classGain = addingClass
        ? `Multiclass: ${input.addNewClass!} 1`
        : `${target!.class} ${target!.level}→${newClassLevel}`;

      nextMeta = {
        ...nextMeta,
        levelHistory: [
          ...(nextMeta.levelHistory ?? []),
          {
            at: new Date().toISOString(),
            totalLevel: newTotalLevel,
            classGain,
            hpGain,
            ...(input.subclass?.trim() ? { subclass: input.subclass.trim() } : {}),
            ...(input.feat?.trim() ? { feat: input.feat.trim() } : {}),
            ...(input.asi ? { asi: input.asi } : {}),
          },
        ],
      };

      let nextSpells: SpellLoadout | undefined;
      const loadout = (character.spells ?? {
        spells: [],
        slots: {},
      }) as SpellLoadout;

      if (input.applySpellSlots) {
        const suggested = sheetSlotPoolsFromClasses(nextClasses);
        const slots = { ...loadout.slots };
        for (const [level, pool] of Object.entries(suggested)) {
          const prev = slots[level] ?? { max: 0, used: 0 };
          slots[level] = { max: pool.max, used: Math.min(prev.used, pool.max) };
        }
        nextSpells = { ...loadout, slots };

        const warlockLevel = warlockLevelFromClasses(nextClasses);
        if (warlockLevel > 0) {
          const pact = warlockPactMagic(warlockLevel);
          if (pact) {
            nextMeta = {
              ...nextMeta,
              pactMagic: {
                max: pact.max,
                used: nextMeta.pactMagic?.used ?? 0,
                slotLevel: pact.slotLevel,
              },
            };
          }
        }
      }

      if (input.addedSpells && input.addedSpells.length > 0) {
        const mergedSpells = [...loadout.spells];
        for (const spell of input.addedSpells) {
          const exists = mergedSpells.some(
            (s) =>
              s.name.toLowerCase() === spell.name.toLowerCase() &&
              s.level === spell.level,
          );
          if (!exists) mergedSpells.push(spell);
        }
        nextSpells = {
          ...(nextSpells ?? loadout),
          spells: mergedSpells,
        };
      }

      const nextNotes = serializeCharacterNotes(
        parsedNotes.sessionNotes,
        parsedNotes.personality,
        nextMeta,
      );

      const nextXp = milestone
        ? xpForLevel(newTotalLevel)
        : Math.max(character.xp, xpForLevel(newTotalLevel));

      const [row] = await db
        .update(characters)
        .set({
          classes: nextClasses,
          abilityScores: nextScores,
          maxHp: character.maxHp + hpGain,
          xp: nextXp,
          notes: nextNotes,
          ...(nextSpells ? { spells: nextSpells } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .returning();

      return { character: row, hpGain };
    }),

  /** Spend a class feature use with deterministic engine effects (Second Wind, etc.). */
  useFeature: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        featureKey: z.string().trim().min(3).max(120),
        useIndex: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [character] = await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      const parsedNotes = parseCharacterNotes(character.notes);
      const currentHp =
        parsedNotes.meta.currentHp ?? character.maxHp;
      const effectiveMax = effectiveMaxHpFromFeats(
        character.maxHp,
        parsedNotes.meta.feats,
        totalLevel(character.classes),
      );

      const rng = createSeededRng(
        featureUseSeedStable(
          character.id,
          input.featureKey,
          input.useIndex,
        ),
      );

      const result = useClassFeature({
        characterId: character.id,
        classes: character.classes,
        featureKey: input.featureKey,
        resourceUses: parsedNotes.meta.resourceUses,
        currentHp,
        maxHp: effectiveMax,
        rng,
        useIndex: input.useIndex,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.message,
        });
      }

      let nextMeta = {
        ...parsedNotes.meta,
        resourceUses: result.resourceUses,
      };

      if (result.kind === "heal" && result.healAmount != null) {
        nextMeta = {
          ...nextMeta,
          currentHp: currentHp + result.healAmount,
        };
      }

      if (result.kind === "extra_action") {
        nextMeta = {
          ...nextMeta,
          actionSurgeReady: true,
        };
      }

      const nextNotes = serializeCharacterNotes(
        parsedNotes.sessionNotes,
        parsedNotes.personality,
        nextMeta,
      );

      const [row] = await db
        .update(characters)
        .set({ notes: nextNotes, updatedAt: new Date() })
        .where(
          and(
            eq(characters.id, input.id),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .returning();

      return {
        character: row,
        message: result.message,
        healAmount: result.healAmount,
        currentHp: nextMeta.currentHp,
      };
    }),

  /** Add XP to one owned character (GM adjust or encounter share). */
  grantXp: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().min(1).max(500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      try {
        const xp = await grantCharacterXp(
          db,
          ctx.user.id,
          input.id,
          input.amount,
        );
        return { xp };
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }
    }),

  /** Award encounter XP split evenly among active campaign PCs. */
  awardCampaignXp: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        totalXp: z.number().int().min(1).max(500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [campaign] = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found.",
        });
      }
      try {
        return await grantCampaignPartyXp(
          db,
          ctx.user.id,
          input.campaignId,
          input.totalXp,
        );
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error ? err.message : "Could not award XP.",
        });
      }
    }),

  /* ----------------------------------------------------------------------- *
   *  Character ↔ campaign membership (#56)
   * ----------------------------------------------------------------------- */

  /** Campaigns the given owned character currently belongs to. */
  campaigns: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return db
        .select({
          campaignId: campaigns.id,
          name: campaigns.name,
          role: campaignCharacters.role,
          status: campaignCharacters.status,
          joinedAt: campaignCharacters.joinedAt,
        })
        .from(campaignCharacters)
        .innerJoin(campaigns, eq(campaigns.id, campaignCharacters.campaignId))
        .where(
          and(
            eq(campaignCharacters.characterId, input.characterId),
            eq(campaignCharacters.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(campaignCharacters.joinedAt));
    }),

  /** Add an owned character to an owned campaign (idempotent on the pair). */
  addToCampaign: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        campaignId: z.string().uuid(),
        role: z.enum(["pc", "companion", "npc-ally"]).default("pc"),
        status: z.enum(["active", "bench"]).default("active"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [char] = await db
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(
            eq(characters.id, input.characterId),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!char) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      const [camp] = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!camp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found.",
        });
      }

      const [row] = await db
        .insert(campaignCharacters)
        .values({
          campaignId: input.campaignId,
          characterId: input.characterId,
          ownerId: ctx.user.id,
          role: input.role,
          status: input.status,
        })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    }),

  /**
   * Permanently delete an owned character and remove them from every campaign
   * party (My Characters danger action).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const owner = ctx.user.id;
      const [row] = await db
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(eq(characters.id, input.id), eq(characters.ownerId, owner)),
        )
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      await db
        .update(campaignInvites)
        .set({ characterId: null })
        .where(
          and(
            eq(campaignInvites.characterId, input.id),
            eq(campaignInvites.ownerId, owner),
          ),
        );
      await db
        .delete(campaignCharacters)
        .where(
          and(
            eq(campaignCharacters.characterId, input.id),
            eq(campaignCharacters.ownerId, owner),
          ),
        );
      await db
        .delete(characters)
        .where(and(eq(characters.id, input.id), eq(characters.ownerId, owner)));
      return { ok: true };
    }),

  /** Remove a character from a campaign (owner-scoped, idempotent). */
  removeFromCampaign: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(campaignCharacters)
        .where(
          and(
            eq(campaignCharacters.characterId, input.characterId),
            eq(campaignCharacters.campaignId, input.campaignId),
            eq(campaignCharacters.ownerId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  /**
   * Promote a campaign-only character into the owner's library (My Characters).
   * Player-created characters default to `library`; tutorial/campaign pregens
   * stay `campaign_only` until the player imports them voluntarily.
   */
  addToLibrary: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .update(characters)
        .set({ libraryVisibility: "library", updatedAt: new Date() })
        .where(
          and(
            eq(characters.id, input.characterId),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: characters.id });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }
      return row;
    }),

  /**
   * Upload a portrait image to Supabase Storage and set `portrait_url`.
   * Requires `SUPABASE_SERVICE_ROLE_KEY` and a public `character-portraits` bucket.
   */
  uploadPortrait: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        contentType: z.string().trim().min(1).max(100),
        dataBase64: z.string().min(1).max(4_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAllowedPortraitType(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Portrait must be JPEG, PNG, WebP, or GIF.",
        });
      }

      const admin = createAdminClient();
      if (!admin) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Portrait upload is not configured (missing SUPABASE_SERVICE_ROLE_KEY).",
        });
      }

      const db = getDb();
      const [owned] = await db
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(
            eq(characters.id, input.characterId),
            eq(characters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!owned) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      const ext =
        input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "jpg";
      const path = `${ctx.user.id}/${input.characterId}.${ext}`;
      const buffer = Buffer.from(input.dataBase64, "base64");

      const { error: uploadError } = await admin.storage
        .from(PORTRAIT_BUCKET)
        .upload(path, buffer, {
          contentType: input.contentType,
          upsert: true,
        });
      if (uploadError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: uploadError.message,
        });
      }

      const { data: publicData } = admin.storage
        .from(PORTRAIT_BUCKET)
        .getPublicUrl(path);
      const portraitUrl = `${publicData.publicUrl}?v=${Date.now()}`;

      const [updated] = await db
        .update(characters)
        .set({ portraitUrl, updatedAt: new Date() })
        .where(eq(characters.id, input.characterId))
        .returning({ portraitUrl: characters.portraitUrl });

      return { portraitUrl: updated?.portraitUrl ?? portraitUrl };
    }),
});
