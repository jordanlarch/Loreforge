/**
 * Plot Hooks / Quests tRPC router — campaign-scoped quest instances (#59, Q7, Phase B).
 *
 * Quest templates live on Realms entities until accepted; accept copies a template
 * snapshot into `plot_hooks.data`. All procedures are owner-scoped.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  campaignCharacters,
  characters,
  getDb,
  plotHooks,
  realmEntities,
} from "@app/db";
import {
  advanceQuestStep,
  buildQuestInstanceDataFromTemplate,
  buildRewardsGranted,
  evaluateQuestPrerequisites,
  levelForXp,
  markBriefingDelivered,
  normalizeEntityQuests,
  parseQuestInstanceData,
  templateFromInstance,
  type QuestPrerequisiteContext,
  type QuestTemplate,
} from "@app/engine";

import { HOOK_STATUSES, type HookStatus } from "@/lib/campaign-hooks";

import { createTRPCRouter, protectedProcedure } from "../init";
import { grantCampaignPartyXp } from "../../characters-xp";
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

async function loadQuestPrerequisiteContext(
  campaignId: string,
  ownerId: string,
): Promise<QuestPrerequisiteContext> {
  const db = getDb();
  const pcs = await db
    .select({ xp: characters.xp })
    .from(campaignCharacters)
    .innerJoin(characters, eq(campaignCharacters.characterId, characters.id))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.ownerId, ownerId),
        eq(campaignCharacters.role, "pc"),
        eq(campaignCharacters.status, "active"),
      ),
    );

  let partyMaxLevel = 1;
  for (const pc of pcs) {
    partyMaxLevel = Math.max(partyMaxLevel, levelForXp(pc.xp));
  }

  const resolvedRows = await db
    .select({
      sourceTemplateId: plotHooks.sourceTemplateId,
      data: plotHooks.data,
    })
    .from(plotHooks)
    .where(
      and(
        eq(plotHooks.campaignId, campaignId),
        eq(plotHooks.ownerId, ownerId),
        eq(plotHooks.status, "resolved"),
      ),
    );

  const resolvedSourceTemplateIds = new Set<string>();
  const resolvedSnapshotTemplateIds = new Set<string>();
  for (const row of resolvedRows) {
    if (row.sourceTemplateId) {
      resolvedSourceTemplateIds.add(row.sourceTemplateId);
    }
    const snap = parseQuestInstanceData(row.data).templateSnapshot;
    if (snap?.id) resolvedSnapshotTemplateIds.add(snap.id);
  }

  return { partyMaxLevel, resolvedSourceTemplateIds, resolvedSnapshotTemplateIds };
}

function assertPrerequisites(
  template: QuestTemplate,
  ctx: QuestPrerequisiteContext,
) {
  const result = evaluateQuestPrerequisites(template, ctx);
  if (!result.met) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: result.reason,
    });
  }
}

async function grantQuestXpToParty(
  campaignId: string,
  ownerId: string,
  xp: number,
) {
  await grantCampaignPartyXp(getDb(), ownerId, campaignId, xp, {
    split: false,
  });
}

export const questsRouter = createTRPCRouter({
  /** All quest instances for an owned campaign. */
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        /** Soft filter — match tag on template snapshot. */
        tag: z.string().trim().max(40).optional(),
        status: hookStatus.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const rows = await db
        .select()
        .from(plotHooks)
        .where(
          and(
            eq(plotHooks.campaignId, input.campaignId),
            eq(plotHooks.ownerId, ctx.user.id),
            ...(input.status ? [eq(plotHooks.status, input.status)] : []),
          ),
        )
        .orderBy(asc(plotHooks.status), desc(plotHooks.createdAt));

      if (!input.tag) return rows;

      const needle = input.tag.toLowerCase();
      return rows.filter((row) => {
        const tags = parseQuestInstanceData(row.data).templateSnapshot?.tags;
        return tags?.some((t) => t.toLowerCase().includes(needle)) ?? false;
      });
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

      const parsed = parseQuestInstanceData(existing.data);
      const template =
        parsed.templateSnapshot ??
        ({
          id: existing.sourceTemplateId ?? existing.id,
          title: existing.title,
          description: existing.summary,
          teaseText: existing.summary,
          steps: [],
        } satisfies QuestTemplate);

      if (input.status === "open" || input.status === "active") {
        const prereqCtx = await loadQuestPrerequisiteContext(
          existing.campaignId,
          ctx.user.id,
        );
        assertPrerequisites(template, prereqCtx);
      }

      let data = existing.data ?? {};
      if (input.status === "active" && existing.status !== "active") {
        data = {
          ...(typeof data === "object" && data !== null ? data : {}),
          briefingDelivered: false,
        };
      }
      if (input.status === "resolved") {
        const base =
          typeof data === "object" && data !== null
            ? { ...(data as Record<string, unknown>) }
            : {};
        const granted = buildRewardsGranted(template);
        if (granted?.xpPerPc && !base.rewardsGranted) {
          await grantQuestXpToParty(
            existing.campaignId,
            ctx.user.id,
            granted.xpPerPc,
          );
        }
        data = {
          ...base,
          resolvedAt: new Date().toISOString(),
          ...(granted ? { rewardsGranted: granted } : {}),
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
        currentStepId: z.string().min(1).max(64).optional(),
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

  /** Complete the current (or given) step and advance progress (Phase D). */
  completeStep: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stepId: z.string().min(1).max(64).optional(),
        branchStepId: z.string().min(1).max(64).optional(),
      }),
    )
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
      if (existing.status !== "active") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only active quests can advance steps.",
        });
      }

      const parsed = parseQuestInstanceData(existing.data);
      const result = advanceQuestStep(parsed, {
        stepId: input.stepId,
        branchStepId: input.branchStepId,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: result.reason,
        });
      }

      const status: HookStatus = result.completed ? "resolved" : "active";

      let data = result.data as Record<string, unknown>;
      if (status === "resolved") {
        const template = templateFromInstance({
          id: existing.id,
          status: existing.status,
          title: existing.title,
          data: result.data,
        });
        const granted = buildRewardsGranted(template);
        if (granted?.xpPerPc && !parsed.rewardsGranted) {
          await grantQuestXpToParty(
            existing.campaignId,
            ctx.user.id,
            granted.xpPerPc,
          );
        }
        data = {
          ...data,
          resolvedAt: new Date().toISOString(),
          ...(granted ? { rewardsGranted: granted } : {}),
        };
      }

      const [row] = await db
        .update(plotHooks)
        .set({ data, status, updatedAt: new Date() })
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

      const prereqCtx = await loadQuestPrerequisiteContext(
        input.campaignId,
        ctx.user.id,
      );
      assertPrerequisites(template, prereqCtx);

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

/** @deprecated Use `questsRouter` — kept as alias for one release. */
export const hooksRouter = questsRouter;
