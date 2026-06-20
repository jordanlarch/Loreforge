/**
 * Realms tRPC router — owner-scoped worldbuilding entities + relationships
 * (#41, #44).
 *
 * One polymorphic surface for all eight Realms types. The DB row keeps `data`
 * shape-agnostic; this layer owns the per-type zod validation via discriminated
 * unions on `type`. NPC is mechanical (mirrors the character primitives); the
 * other seven are descriptive and derive their `data` schema from the shared
 * `REALM_FIELDS` descriptors so the form, detail view, and validator agree.
 *
 * Relationships are typed directed edges in `realm_relationships`; `links`
 * returns them bidirectionally with the other entity resolved.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, realmEntities, realmRelationships } from "@app/db";

import {
  REALM_ENTITY_TYPES,
  REALM_FIELDS,
  REALM_RELATIONSHIP_KINDS,
  type RealmEntityType,
  type RealmFieldDescriptor,
} from "@/lib/realms";

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

/** Derive a zod `data` schema from a descriptive type's field descriptors. */
function buildFieldsSchema(fields: readonly RealmFieldDescriptor[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.kind === "number") {
      shape[field.key] = z
        .number()
        .int()
        .min(field.min ?? 0)
        .max(field.max ?? 100_000_000)
        .default(field.min ?? 0);
    } else if (field.kind === "select") {
      const options = (field.options ?? [""]) as [string, ...string[]];
      shape[field.key] = z.enum(options).default(options[0]);
    } else {
      shape[field.key] = z
        .string()
        .trim()
        .max(field.max ?? (field.kind === "textarea" ? 4000 : 200))
        .default("");
    }
  }
  return z.object(shape);
}

/** The `data` schema for a given type. */
function dataSchemaFor(type: RealmEntityType) {
  return type === "npc" ? npcData : buildFieldsSchema(REALM_FIELDS[type]);
}

/**
 * Validate a raw `data` payload against its type's schema, returning the parsed
 * (defaulted) object or throwing a BAD_REQUEST with the first issue. Keeps the
 * per-type validation precise without a brittle dynamic discriminated union.
 */
function parseData(
  type: RealmEntityType,
  raw: unknown,
): Record<string, unknown> {
  const result = dataSchemaFor(type).safeParse(raw ?? {});
  if (!result.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.error.issues[0]?.message ?? "Invalid entity data.",
    });
  }
  return result.data as Record<string, unknown>;
}

const createInput = z.object({
  type: realmType,
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(500).default(""),
  isStub: z.boolean().default(false),
  data: z.unknown().optional(),
});

const updateInput = createInput.extend({ id: z.string().uuid() });

const relationshipKind = z.enum(REALM_RELATIONSHIP_KINDS);

/** Confirm every id is owned by the user; throws NOT_FOUND otherwise. */
async function assertOwnedEntities(
  db: ReturnType<typeof getDb>,
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: realmEntities.id })
    .from(realmEntities)
    .where(
      and(eq(realmEntities.ownerId, userId), inArray(realmEntities.id, ids)),
    );
  if (rows.length !== ids.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
  }
}

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

  /** Create an entity owned by the current user (any of the eight types). */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const data = parseData(input.type, input.data);
      const [row] = await db
        .insert(realmEntities)
        .values({
          ownerId: ctx.user.id,
          type: input.type,
          name: input.name,
          summary: input.summary,
          isStub: input.isStub,
          data,
        })
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create entity.",
        });
      }
      return row;
    }),

  /** Replace an owned entity's editable fields (name / summary / stub / data). */
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const data = parseData(input.type, input.data);
      const [row] = await db
        .update(realmEntities)
        .set({
          name: input.name,
          summary: input.summary,
          isStub: input.isStub,
          data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(realmEntities.id, input.id),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
      }
      return row;
    }),

  /**
   * Relationships touching an entity, both directions. Each result carries the
   * edge id, its `kind`, whether the queried entity is the `from` or `to` side,
   * and the resolved other entity (id / name / type) for display + linking.
   */
  links: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const edges = await db
        .select()
        .from(realmRelationships)
        .where(
          and(
            eq(realmRelationships.ownerId, ctx.user.id),
            or(
              eq(realmRelationships.fromId, input.entityId),
              eq(realmRelationships.toId, input.entityId),
            ),
          ),
        )
        .orderBy(desc(realmRelationships.createdAt));

      const otherIds = [
        ...new Set(
          edges.map((e) =>
            e.fromId === input.entityId ? e.toId : e.fromId,
          ),
        ),
      ];
      const others =
        otherIds.length > 0
          ? await db
              .select({
                id: realmEntities.id,
                name: realmEntities.name,
                type: realmEntities.type,
              })
              .from(realmEntities)
              .where(
                and(
                  eq(realmEntities.ownerId, ctx.user.id),
                  inArray(realmEntities.id, otherIds),
                ),
              )
          : [];
      const byId = new Map(others.map((o) => [o.id, o]));

      return edges.flatMap((edge) => {
        const outgoing = edge.fromId === input.entityId;
        const otherId = outgoing ? edge.toId : edge.fromId;
        const other = byId.get(otherId);
        if (!other) return [];
        return [
          {
            id: edge.id,
            kind: edge.kind,
            direction: outgoing ? ("out" as const) : ("in" as const),
            other,
          },
        ];
      });
    }),

  /** Create a typed directed edge between two owned entities. */
  link: protectedProcedure
    .input(
      z.object({
        fromId: z.string().uuid(),
        toId: z.string().uuid(),
        kind: relationshipKind,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromId === input.toId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An entity can't link to itself.",
        });
      }
      const db = getDb();
      await assertOwnedEntities(db, ctx.user.id, [input.fromId, input.toId]);

      const [existing] = await db
        .select({ id: realmRelationships.id })
        .from(realmRelationships)
        .where(
          and(
            eq(realmRelationships.ownerId, ctx.user.id),
            eq(realmRelationships.fromId, input.fromId),
            eq(realmRelationships.toId, input.toId),
            eq(realmRelationships.kind, input.kind),
          ),
        )
        .limit(1);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That link already exists.",
        });
      }

      const [row] = await db
        .insert(realmRelationships)
        .values({
          ownerId: ctx.user.id,
          fromId: input.fromId,
          toId: input.toId,
          kind: input.kind,
        })
        .returning();
      return row;
    }),

  /** Delete an owned relationship edge. */
  unlink: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .delete(realmRelationships)
        .where(
          and(
            eq(realmRelationships.id, input.id),
            eq(realmRelationships.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: realmRelationships.id });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Link not found." });
      }
      return { id: row.id };
    }),
});
