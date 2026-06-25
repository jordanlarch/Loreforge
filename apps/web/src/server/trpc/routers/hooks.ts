/**
 * Plot Hooks tRPC router — campaign-scoped plot hooks + lifecycle (#59, Q7).
 *
 * Hooks live embedded on Realms entities until accepted into a campaign, at
 * which point `acceptFromRealms` promotes one to a first-class `plot_hooks` row
 * that moves through the Kanban lifecycle. All procedures are owner-scoped via
 * `assertCampaignOwner` plus owner-filtered writes.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, plotHooks, realmEntities } from "@app/db";

import { HOOK_STATUSES } from "@/lib/campaign-hooks";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

const hookStatus = z.enum(HOOK_STATUSES);

export const hooksRouter = createTRPCRouter({
  /** All plot hooks for an owned campaign, newest first. */
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

  /** Author a plot hook directly in the campaign. */
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
      const [row] = await db
        .insert(plotHooks)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          title: input.title,
          summary: input.summary,
          status: input.status,
        })
        .returning();
      return row;
    }),

  /** Move a hook to a new lifecycle stage (Kanban drag persists here). */
  setStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: hookStatus }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .update(plotHooks)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(eq(plotHooks.id, input.id), eq(plotHooks.ownerId, ctx.user.id)),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Hook not found." });
      }
      return row;
    }),

  /** Edit hook title/summary (CAMP-5 detail panel). */
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Hook not found." });
      }
      return row;
    }),

  /** Delete a hook (owner-scoped, idempotent). */
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
   * Accept a Realms-embedded hook into the campaign (#59 lifecycle, Q7): create
   * a first-class campaign hook tagged with the source entity, landing in the
   * Open column ready to run.
   */
  acceptFromRealms: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [entity] = await db
        .select({ id: realmEntities.id })
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
      const [row] = await db
        .insert(plotHooks)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          title: input.title,
          summary: input.summary,
          status: "open",
          sourceEntityId: input.entityId,
        })
        .returning();
      return row;
    }),
});
