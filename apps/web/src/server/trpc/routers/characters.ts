/**
 * Characters tRPC router — persistent, owner-scoped player characters
 * (issue #3). Replaces the fixture-only sheet: create / get / list back the
 * Characters surfaces with real DB rows. Derived sheet values (mods,
 * proficiency, saves, skills) are still computed via `@app/engine`, never here.
 *
 * The Creation Wizard (#6) and inline edit (#7) build on this surface.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { characters, getDb } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

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
});
