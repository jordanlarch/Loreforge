/**
 * Sessions tRPC router (#145, MEM-4) — play sessions with auto-generated recaps.
 *
 * `end` closes the unsessioned span of a campaign's live chat: it records the
 * `[startSeq, endSeq)` range, generates a recap, and embeds it as a
 * `session_recap` RAG source so it grounds future sessions. Recap generation is
 * best-effort and env-gated; it runs **inline** by default and dispatches to the
 * durable `generate-recap` Trigger task when `TRIGGER_SECRET_KEY` is configured
 * (mirrors `generateCascadeAsync` ↔ synchronous cascade). `list` backs the
 * future CAMP-6 Sessions tab. Owner-scoped throughout.
 */
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, max } from "drizzle-orm";
import { z } from "zod";

import { chatMessages, getDb, sessions } from "@app/db";

import { runAndStoreRecap } from "@/server/memory/recap";
import type { GenerateRecapPayload } from "@/trigger/generate-recap";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

/** Whether the durable (Trigger.dev) recap route can be used at runtime. */
function isTriggerConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export const sessionsRouter = createTRPCRouter({
  /** All ended sessions for an owned campaign, most recent first. */
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.campaignId, input.campaignId),
            eq(sessions.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(sessions.endedAt));
    }),

  /**
   * End the current session: record the chat span since the last session and
   * generate + embed its recap. Recap runs inline (best-effort) unless a
   * Trigger runtime key is configured, in which case it's dispatched durably.
   */
  end: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();

      const [prior] = await db
        .select({ prevEnd: max(sessions.endSeq) })
        .from(sessions)
        .where(
          and(
            eq(sessions.campaignId, input.campaignId),
            eq(sessions.ownerId, ctx.user.id),
          ),
        );
      const startSeq = prior?.prevEnd ?? 0;

      const rows = await db
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.campaignId, input.campaignId),
            gte(chatMessages.seq, startSeq),
          ),
        )
        .orderBy(asc(chatMessages.seq));
      if (rows.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No new activity since the last session.",
        });
      }

      const endSeq = rows[rows.length - 1]!.seq + 1;
      const lines = rows
        .filter((r) => r.kind === "player" || r.kind === "gm")
        .map((r) => `${r.author}: ${r.text}`);

      const [session] = await db
        .insert(sessions)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          startSeq,
          endSeq,
          startedAt: rows[0]!.createdAt,
          endedAt: new Date(),
        })
        .returning();
      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record session.",
        });
      }

      // Durable route when configured; otherwise generate + embed inline.
      if (isTriggerConfigured()) {
        const payload: GenerateRecapPayload = {
          sessionId: session.id,
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          lines,
        };
        await tasks.trigger("generate-recap", payload);
        return { session, recapPending: true as const };
      }

      const { recap, model } = await runAndStoreRecap(db, {
        sessionId: session.id,
        campaignId: input.campaignId,
        ownerId: ctx.user.id,
        lines,
      });
      return {
        session: { ...session, recap, model },
        recapPending: false as const,
      };
    }),
});
