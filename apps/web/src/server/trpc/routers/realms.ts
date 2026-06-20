/**
 * Realms tRPC router — owner-scoped worldbuilding entities (#41).
 *
 * One polymorphic surface for all eight Realms types: `list` (optionally
 * type-filtered), `counts` (sidebar tallies), `get`, and `create`. The DB row
 * keeps `data` shape-agnostic; this layer owns the per-type zod validation via
 * a discriminated union on `type`. NPC is the first realized type — the other
 * seven forms land in slice #5. NPC mechanical fields mirror the character
 * primitives so the detail page derives its stat block through `@app/engine`.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, realmEntities } from "@app/db";

import { REALM_ENTITY_TYPES, type RealmEntityType } from "@/lib/realms";

import { createTRPCRouter, protectedProcedure } from "../init";

const realmType = z.enum(REALM_ENTITY_TYPES);

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

/** Per-type payload for an NPC, validated before it lands in `data`. */
const npcData = z.object({
  species: z.string().trim().max(80).default(""),
  role: z.string().trim().max(80).default(""),
  alignment: z.string().trim().max(40).default(""),
  classes: z.array(classLevel).max(10).default([]),
  abilityScores,
  maxHp: z.number().int().min(1).max(1000),
  baseAc: z.number().int().min(1).max(40),
  speed: z.number().int().min(0).max(200).default(30),
  saveProficiencies: z.array(ABILITY).max(6).default([]),
  skillProficiencies: z.array(z.string().trim().max(40)).max(30).default([]),
});

const sharedFields = {
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(500).default(""),
  isStub: z.boolean().default(false),
};

/**
 * Discriminated by `type` so each entity type validates its own `data` shape.
 * Only NPC is realized in this slice; the other seven types are added here as
 * their forms ship (#5).
 */
const createInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("npc"),
    ...sharedFields,
    data: npcData,
  }),
]);

export const realmsRouter = createTRPCRouter({
  /** Entities owned by the current user, optionally filtered by type. */
  list: protectedProcedure
    .input(z.object({ type: realmType.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [
        eq(realmEntities.ownerId, ctx.user.id),
        input?.type ? eq(realmEntities.type, input.type) : undefined,
      ].filter(Boolean);
      return db
        .select()
        .from(realmEntities)
        .where(and(...conditions))
        .orderBy(desc(realmEntities.createdAt));
    }),

  /** Per-type counts for the sidebar, plus a grand total under `all`. */
  counts: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        type: realmEntities.type,
        count: sql<number>`count(*)::int`,
      })
      .from(realmEntities)
      .where(eq(realmEntities.ownerId, ctx.user.id))
      .groupBy(realmEntities.type);

    const counts = Object.fromEntries(
      REALM_ENTITY_TYPES.map((t) => [t, 0]),
    ) as Record<RealmEntityType, number>;
    let all = 0;
    for (const row of rows) {
      counts[row.type] = row.count;
      all += row.count;
    }
    return { all, byType: counts };
  }),

  /** A single owned entity, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(realmEntities)
        .where(
          and(
            eq(realmEntities.id, input.id),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Create an entity owned by the current user (NPC only in this slice). */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { type, name, summary, isStub, data } = input;
      const [row] = await db
        .insert(realmEntities)
        .values({ ownerId: ctx.user.id, type, name, summary, isStub, data })
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create entity.",
        });
      }
      return row;
    }),
});
