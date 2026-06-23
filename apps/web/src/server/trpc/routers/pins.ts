/**
 * Pinned-memory tRPC router (#155, P5) — durable DM-authored facts the AI-GM
 * weights heavily during live play.
 *
 * `create` records the pin and best-effort embeds it as a `pinned_memory` RAG
 * source; `remove` deletes the row and its embeddings. The live-turn consumer is
 * the ws-server `world-knowledge` rerank (a high-weighted `pinned_memory`
 * category). Owner-scoped throughout; embedding is env-gated + best-effort so it
 * never breaks the mutation.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, pinnedMemories } from "@app/db";

import {
  deletePinEmbeddingsBestEffort,
  embedPinBestEffort,
} from "@/server/memory/pins";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

export const pinsRouter = createTRPCRouter({
  /** All pinned memories for an owned campaign, most recent first. */
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select()
        .from(pinnedMemories)
        .where(
          and(
            eq(pinnedMemories.campaignId, input.campaignId),
            eq(pinnedMemories.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(pinnedMemories.createdAt));
    }),

  /** Pin a durable fact and best-effort embed it for live-turn retrieval. */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [pin] = await db
        .insert(pinnedMemories)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          content: input.content,
        })
        .returning();
      if (!pin) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record pinned memory.",
        });
      }
      await embedPinBestEffort(db, {
        pinId: pin.id,
        campaignId: input.campaignId,
        ownerId: ctx.user.id,
        content: pin.content,
      });
      return pin;
    }),

  /** Remove a pinned memory and its embeddings. */
  remove: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        pinId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const deleted = await db
        .delete(pinnedMemories)
        .where(
          and(
            eq(pinnedMemories.id, input.pinId),
            eq(pinnedMemories.campaignId, input.campaignId),
            eq(pinnedMemories.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: pinnedMemories.id });
      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pinned memory not found.",
        });
      }
      await deletePinEmbeddingsBestEffort(db, input.pinId);
      return { ok: true as const };
    }),
});
