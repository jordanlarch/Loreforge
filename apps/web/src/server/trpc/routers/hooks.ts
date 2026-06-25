/**
 * Plot Hooks / Quests tRPC router — campaign-scoped quest instances (#59, Q7, Phase B).
 *
 * Quest templates live on Realms entities until accepted; accept copies a template
 * snapshot into `plot_hooks.data`. All procedures are owner-scoped.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, plotHooks, realmEntities } from "@app/db";
import {
  buildQuestInstanceDataFromTemplate,
  markBriefingDelivered,
  normalizeEntityQuests,
  parseQuestInstanceData,
  type QuestTemplate,
} from "@app/engine";

import { HOOK_STATUSES } from "@/lib/campaign-hooks";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

const hookStatus = z.enum(HOOK_STATUSES);

function findTemplateOnEntity(
  data: unknown,
  entityId: string,
  templateId?: string,
  title?: string,
): QuestTemplate | undefined {
  const quests = normalizeEntityQuests(data, entityId);
  if (quests.length === 0) return undefined;
  if (templateId) {
    return quests.find((q) => q.id === templateId);
  }
  const trimmed = title?.trim();
  if (trimmed) {
    return quests.find(
      (q) =>
        q.title === trimmed ||
        q.teaseText === trimmed ||
        q.description === trimmed,
    );
  }
  return quests[0];
}

export const hooksRouter = createTRPCRouter({
  /** All quest instances for an owned campaign. */
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select()
        .from(plotHooks)
        .where(
          and(
            eq(plotHooks.campaignId, input.campaignId),
            eq(plotHooks.ownerId, ctx.user.id),
          ),
        )
        .orderBy(asc(plotHooks.status), desc(plotHooks.createdAt));
    }),

  /** Author a quest directly in the campaign (minimal template snapshot). */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(2000).default(""),
        status: hookStatus.default("suggested"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const template: QuestTemplate = {
        id: crypto.randomUUID(),
        title: input.title,
        description: input.summary,
        teaseText: input.summary || input.title,
        source: "manual",
        steps: [],
      };
      const [row] = await db
        .insert(plotHooks)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          title: input.title,
          summary: input.summary,
          status: input.status,
          data: buildQuestInstanceDataFromTemplate(template),
        })
        .returning();
      return row;
    }),

  /** Move a quest to a new lifecycle stage (Kanban drag persists here). */
  setStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: hookStatus }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db
        .select()
        .from(plotHooks)
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found." });
      }

      let data = existing.data ?? {};
      if (input.status === "active" && existing.status !== "active") {
        data = {
          ...(typeof data === "object" && data !== null ? data : {}),
          briefingDelivered: false,
        };
      }
      if (input.status === "resolved") {
        data = {
          ...data,
          resolvedAt: new Date().toISOString(),
        };
      }

      const [row] = await db
        .update(plotHooks)
        .set({ status: input.status, data, updatedAt: new Date() })
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .returning();
      return row;
    }),

  /** Edit quest title/summary (display fields on the Kanban card). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .update(plotHooks)
        .set({
          title: input.title,
          summary: input.summary,
          updatedAt: new Date(),
        })
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found." });
      }
      return row;
    }),

  /** Update quest instance progress / outcome notes (Phase B detail panel). */
  updateInstance: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        currentStepId: z.string().uuid().optional(),
        outcomeNotes: z.string().trim().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db
        .select({ data: plotHooks.data })
        .from(plotHooks)
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found." });
      }
      const parsed = parseQuestInstanceData(existing.data);
      const data = {
        ...existing.data,
        currentStepId: input.currentStepId ?? parsed.currentStepId,
        outcomeNotes:
          input.outcomeNotes !== undefined
            ? input.outcomeNotes
            : parsed.outcomeNotes,
      };
      const [row] = await db
        .update(plotHooks)
        .set({ data, updatedAt: new Date() })
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .returning();
      return row;
    }),

  /** Mark in-fiction briefing as delivered (Live Play runtime). */
  markBriefingDelivered: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [existing] = await db
        .select({ data: plotHooks.data })
        .from(plotHooks)
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found." });
      }
      const data = markBriefingDelivered(existing.data);
      const [row] = await db
        .update(plotHooks)
        .set({ data, updatedAt: new Date() })
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .returning();
      return row;
    }),

  /** Delete a quest (owner-scoped, idempotent). */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(plotHooks)
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        );
      return { ok: true };
    }),

  /**
   * Accept a Realms quest template into the campaign (Q7): snapshot template
   * into `data` and land in the Open column.
   */
  acceptFromRealms: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(2000).default(""),
        /** Engine ULID from `data.quests` — not a Postgres uuid. */
        templateId: z.string().trim().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [entity] = await db
        .select({ id: realmEntities.id, data: realmEntities.data })
        .from(realmEntities)
        .where(
          and(
            eq(realmEntities.id, input.entityId),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
      }

      const template =
        findTemplateOnEntity(
          entity.data,
          input.entityId,
          input.templateId,
          input.title,
        ) ??
        ({
          id: input.templateId ?? crypto.randomUUID(),
          title: input.title,
          description: input.summary,
          teaseText: input.summary || input.title,
          source: "migrated" as const,
          steps: [],
        } satisfies QuestTemplate);

      const instanceData = buildQuestInstanceDataFromTemplate(template);
      const summary =
        input.summary.trim() ||
        template.teaseText?.trim() ||
        template.description?.trim() ||
        template.title;

      const [row] = await db
        .insert(plotHooks)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          title: template.title.slice(0, 200),
          summary: summary.slice(0, 2000),
          status: "open",
          sourceEntityId: input.entityId,
          sourceTemplateId: template.id,
          data: instanceData,
        })
        .returning();
      return row;
    }),
});
