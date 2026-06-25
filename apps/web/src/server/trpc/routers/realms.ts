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
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, realmEntities, realmRelationships } from "@app/db";
import { LlmGenerationError } from "@app/llm";

import type {
  GenerateCascadePayload,
  GenerateCascadeResult,
} from "@/trigger/generate-cascade";

import {
  REALM_ENTITY_TYPES,
  REALM_RELATIONSHIP_KINDS,
  type RealmEntityType,
} from "@/lib/realms";
import {
  deleteCrossLinkEmbeddingsBestEffort,
  embedCrossLinkOnWrite,
} from "@/server/memory/cross-link";
import { embedRealmEntityOnWrite } from "@/server/memory/embed";
import { parseData } from "@/server/realms/schemas";
import { wireCascadeNpcLocations, wireCascadeQuestInheritance } from "@/server/realms/cascade-wiring";
import {
  GeneratorNotConfiguredError,
  expandStubData,
  generateNewEntity,
  isConfigured as isGeneratorConfigured,
  loadParentContext,
  logGeneration,
  persistChildren,
  regenerateEntityCandidate,
} from "@/server/realms/generator";

import { createTRPCRouter, protectedProcedure } from "../init";

const realmType = z.enum(REALM_ENTITY_TYPES);

/** Map generator/LLM failures onto clean tRPC errors. */
function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;
  if (err instanceof GeneratorNotConfiguredError) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
  }
  if (err instanceof LlmGenerationError) {
    return new TRPCError({
      code: "UNPROCESSABLE_CONTENT",
      message:
        "The AI couldn't produce a valid result. Please try again or adjust your prompt.",
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Generation failed. Please try again.",
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Guard: AI generation requires ANTHROPIC_API_KEY. */
function assertGeneratorConfigured(): void {
  if (!isGeneratorConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "AI generation isn't configured yet. Set ANTHROPIC_API_KEY to enable generators.",
    });
  }
}

/** Whether the durable (Trigger.dev) cascade path can be used at runtime. */
function isTriggerConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

/** Collapse Trigger.dev's many run statuses into a simple lifecycle. */
function mapRunStatus(status: string): "pending" | "completed" | "failed" {
  if (status === "COMPLETED") return "completed";
  if (
    [
      "FAILED",
      "CRASHED",
      "CANCELED",
      "SYSTEM_FAILURE",
      "INTERRUPTED",
      "TIMED_OUT",
      "EXPIRED",
    ].includes(status)
  ) {
    return "failed";
  }
  return "pending";
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

  /**
   * The whole owned world as a node-link graph: minimal entity nodes plus the
   * typed relationship edges. Powers the Realms Graph view (#50) — a single
   * round trip so the client can lay the graph out without N per-node fetches.
   */
  graph: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [nodes, edges] = await Promise.all([
      db
        .select({
          id: realmEntities.id,
          name: realmEntities.name,
          type: realmEntities.type,
          isStub: realmEntities.isStub,
        })
        .from(realmEntities)
        .where(eq(realmEntities.ownerId, ctx.user.id)),
      db
        .select({
          id: realmRelationships.id,
          fromId: realmRelationships.fromId,
          toId: realmRelationships.toId,
          kind: realmRelationships.kind,
        })
        .from(realmRelationships)
        .where(eq(realmRelationships.ownerId, ctx.user.id)),
    ]);
    return { nodes, edges };
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
      await embedRealmEntityOnWrite(db, row);
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
      await embedRealmEntityOnWrite(db, row);
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

      // Embed the edge as a retrievable cross-link (GEN-5). Best-effort.
      if (row) {
        const endpoints = await db
          .select({
            id: realmEntities.id,
            name: realmEntities.name,
            type: realmEntities.type,
          })
          .from(realmEntities)
          .where(inArray(realmEntities.id, [input.fromId, input.toId]));
        const from = endpoints.find((e) => e.id === input.fromId);
        const to = endpoints.find((e) => e.id === input.toId);
        if (from && to) {
          await embedCrossLinkOnWrite(db, {
            relationshipId: row.id,
            ownerId: ctx.user.id,
            kind: input.kind,
            fromName: from.name,
            fromType: from.type,
            toName: to.name,
            toType: to.type,
          });
        }
      }
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
      await deleteCrossLinkEmbeddingsBestEffort(db, row.id);
      return { id: row.id };
    }),

  /* ----------------------------------------------------------------------- *
   *  AI generation (Realms generator pipeline)
   * ----------------------------------------------------------------------- */

  /** Whether AI generation is configured (drives UI affordances). */
  generatorStatus: protectedProcedure.query(() => ({
    configured: isGeneratorConfigured(),
    background: isTriggerConfigured(),
  })),

  /**
   * Generate a brand-new entity from a free-text concept (D3 sync path, D10).
   * Validates the model's output through `parseData`, inserts the entity (and
   * any emitted child stubs + edges — D6), logs the run, and returns the row so
   * the client can navigate to its detail page.
   */
  generate: protectedProcedure
    .input(
      z.object({
        type: realmType,
        concept: z.string().trim().min(1).max(2000),
        hints: z
          .object({
            species: z.string().trim().max(80).optional(),
            role: z.string().trim().max(80).optional(),
            level: z.number().int().min(1).max(20).optional(),
          })
          .optional(),
        // Preferred values for the type's own fields (Advanced Form). The
        // user's explicit choices win over the model's output.
        seed: z
          .record(z.union([z.string().max(4000), z.number()]))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertGeneratorConfigured();
      const db = getDb();
      try {
        const { data: envelope, usage, model } = await generateNewEntity({
          db,
          type: input.type,
          concept: input.concept,
          hints: input.hints,
          seed: input.seed,
          ownerId: ctx.user.id,
        });
        // Merge the user's explicit seed values over the model output, then
        // re-validate through the same path the manual write uses (Q12).
        const merged = input.seed
          ? { ...envelope.data, ...input.seed }
          : envelope.data;
        const data = parseData(input.type, merged);
        const [row] = await db
          .insert(realmEntities)
          .values({
            ownerId: ctx.user.id,
            type: input.type,
            name: envelope.name,
            summary: envelope.summary,
            isStub: false,
            data,
          })
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create entity.",
          });
        }
        const childCount = envelope.children?.length
          ? await persistChildren(db, ctx.user.id, row.id, envelope.children)
          : 0;
        if (childCount > 0) {
          await wireCascadeNpcLocations(db, ctx.user.id, row.id);
          await wireCascadeQuestInheritance(db, ctx.user.id, row.id);
        }
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: row.id,
          entityType: input.type,
          mode: childCount > 0 ? "cascade" : "new",
          status: "success",
          model,
          usage,
        });
        await embedRealmEntityOnWrite(db, row);
        return { entity: row, childCount };
      } catch (err) {
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: null,
          entityType: input.type,
          mode: "new",
          status: "error",
          errorMessage: errorMessage(err),
        });
        throw toTRPCError(err);
      }
    }),

  /**
   * Expand an existing stub in place (D5/D6): fill its `data`, flip `isStub` to
   * false. Uses the stub's name/summary plus its relationships as context.
   */
  expandStub: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertGeneratorConfigured();
      const db = getDb();
      const [entity] = await db
        .select()
        .from(realmEntities)
        .where(
          and(
            eq(realmEntities.id, input.id),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
      }
      if (!entity.isStub) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This entity is not a stub.",
        });
      }
      const type = entity.type as RealmEntityType;
      try {
        const parentContext = await loadParentContext(
          db,
          ctx.user.id,
          entity.id,
        );
        const { data: rawData, usage, model } = await expandStubData({
          db,
          type,
          name: entity.name,
          summary: entity.summary,
          parentContext,
          ownerId: ctx.user.id,
          entityId: entity.id,
        });
        const data = parseData(type, rawData, entity.id);
        const [row] = await db
          .update(realmEntities)
          .set({ data, isStub: false, updatedAt: new Date() })
          .where(
            and(
              eq(realmEntities.id, entity.id),
              eq(realmEntities.ownerId, ctx.user.id),
            ),
          )
          .returning();
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: entity.id,
          entityType: type,
          mode: "expand",
          status: "success",
          model,
          usage,
        });
        if (row) await embedRealmEntityOnWrite(db, row);
        return row!;
      } catch (err) {
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: entity.id,
          entityType: type,
          mode: "expand",
          status: "error",
          errorMessage: errorMessage(err),
        });
        throw toTRPCError(err);
      }
    }),

  /**
   * Produce a regeneration candidate (D7/D10): preview-only — nothing is
   * written. The client previews and, on accept, calls `update`. `fields`
   * narrows the regeneration to specific keys (per-section); omitted = whole.
   */
  regenerate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        fields: z.array(z.string().trim().max(60)).max(30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertGeneratorConfigured();
      const db = getDb();
      const [entity] = await db
        .select()
        .from(realmEntities)
        .where(
          and(
            eq(realmEntities.id, input.id),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
      }
      const type = entity.type as RealmEntityType;
      try {
        const { data: candidate, usage, model } = await regenerateEntityCandidate(
          {
            db,
            type,
            name: entity.name,
            existingData: entity.data,
            fields: input.fields,
            ownerId: ctx.user.id,
            entityId: entity.id,
          },
        );
        // Merge a (possibly partial) candidate over current values, then
        // validate so the preview is always a complete, valid payload.
        const merged = { ...entity.data, ...candidate.data };
        const data = parseData(type, merged);
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: entity.id,
          entityType: type,
          mode: "regenerate",
          status: "success",
          model,
          usage,
        });
        return { summary: candidate.summary, data };
      } catch (err) {
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: entity.id,
          entityType: type,
          mode: "regenerate",
          status: "error",
          errorMessage: errorMessage(err),
        });
        throw toTRPCError(err);
      }
    }),

  /**
   * Kick off a DURABLE cascade generation on Trigger.dev (D3) and return the
   * run id to poll. The v1 thin-schema cascade also runs synchronously via
   * `generate`; this is the timeout-free route reused as deep cascades arrive.
   */
  generateCascadeAsync: protectedProcedure
    .input(
      z.object({
        type: realmType,
        concept: z.string().trim().min(1).max(2000),
        hints: z
          .object({
            species: z.string().trim().max(80).optional(),
            role: z.string().trim().max(80).optional(),
            level: z.number().int().min(1).max(20).optional(),
          })
          .optional(),
        seed: z
          .record(z.union([z.string().max(4000), z.number()]))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isTriggerConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Background generation isn't configured yet. Set TRIGGER_SECRET_KEY to enable it.",
        });
      }
      const payload: GenerateCascadePayload = {
        ownerId: ctx.user.id,
        type: input.type,
        concept: input.concept,
        hints: input.hints,
        seed: input.seed,
      };
      const handle = await tasks.trigger("generate-cascade", payload);
      return { runId: handle.id };
    }),

  /** Poll a cascade run's status (drives the generation progress UI). */
  cascadeRun: protectedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      if (!isTriggerConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Background generation isn't configured.",
        });
      }
      const run = await runs.retrieve(input.runId);
      const status = mapRunStatus(String(run.status));
      const output = run.output as GenerateCascadeResult | undefined;
      const error = (run as { error?: { message?: string } }).error?.message;
      return {
        status,
        entityId: output?.entityId ?? null,
        childCount: output?.childCount ?? 0,
        error: status === "failed" ? error ?? "Generation failed." : null,
      };
    }),
});
