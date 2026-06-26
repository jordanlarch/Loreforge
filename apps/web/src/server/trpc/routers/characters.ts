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
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  isValidAsiChoice,
  levelUpSeed,
  totalLevel,
  createSeededRng,
  type AsiChoice,
  type HpMethod,
} from "@app/engine";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  campaignCharacters,
  campaignInvites,
  campaigns,
  characters,
  codexClasses,
  getDb,
} from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

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
      const target = classes[input.classIndex];
      if (!target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No such class on this character.",
        });
      }
      if (target.level >= MAX_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${target.class} is already at level ${MAX_LEVEL}.`,
        });
      }
      if (totalLevel(classes) >= MAX_LEVEL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Character is already at the level ${MAX_LEVEL} cap.`,
        });
      }

      // Resolve the hit die from the Codex by display name (classes store the
      // name, not the slug). Required so the engine — not the app — computes HP.
      const [klass] = await db
        .select({ hitDie: codexClasses.hitDie })
        .from(codexClasses)
        .where(eq(codexClasses.name, target.class))
        .limit(1);

      if (!klass) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't determine the hit die for "${target.class}". Level-up needs an SRD class.`,
        });
      }

      const newClassLevel = target.level + 1;
      const newTotalLevel = totalLevel(classes) + 1;

      const grantsAsi = grantsAsiAtLevel(target.class, newClassLevel);
      if (grantsAsi && !input.asi) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This level grants an Ability Score Improvement — choose +2 to one ability or +1 to two.",
        });
      }
      if (input.asi && !grantsAsi) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This level does not grant an Ability Score Improvement.",
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

      const conMod = abilityModifier(nextScores.con);
      const method: HpMethod = input.hpMethod;
      const hpGain = hpGainOnLevelUp(klass.hitDie, conMod, {
        mode: method,
        rng:
          method === "roll"
            ? createSeededRng(levelUpSeed(character.id, newTotalLevel))
            : undefined,
      });

      const nextClasses = classes.map((c, i) =>
        i === input.classIndex ? { ...c, level: newClassLevel } : c,
      );

      const [row] = await db
        .update(characters)
        .set({
          classes: nextClasses,
          abilityScores: nextScores,
          maxHp: character.maxHp + hpGain,
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
});
