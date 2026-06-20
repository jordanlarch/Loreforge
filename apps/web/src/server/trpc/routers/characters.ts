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
  hpGainOnLevelUp,
  levelUpSeed,
  totalLevel,
  createSeededRng,
  type HpMethod,
} from "@app/engine";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { characters, codexClasses, getDb } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

/** Hard 5E ceiling for a single class and for total character level. */
const MAX_LEVEL = 20;

const ABILITY = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

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
} as const;

const createInput = z.object({
  ...characterFields,
  species: characterFields.species.default(""),
  background: characterFields.background.default(""),
  speed: characterFields.speed.default(30),
  saveProficiencies: characterFields.saveProficiencies.default([]),
  skillProficiencies: characterFields.skillProficiencies.default([]),
});

const updatePatch = z.object(characterFields).partial();

const updateInput = z
  .object({ id: z.string().uuid() })
  .merge(updatePatch)
  .refine((input) => Object.keys(input).some((key) => key !== "id"), {
    message: "No fields to update.",
  });

export const charactersRouter = createTRPCRouter({
  /** Characters owned by the current user, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(characters)
      .where(eq(characters.ownerId, ctx.user.id))
      .orderBy(desc(characters.createdAt), asc(characters.name));
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
   * applies them yet. Rejects past level 20 (per-class and total).
   */
  levelUp: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        classIndex: z.number().int().min(0).default(0),
        hpMethod: z.enum(["average", "roll"]),
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
      const conMod = abilityModifier(character.abilityScores.con);
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
});
