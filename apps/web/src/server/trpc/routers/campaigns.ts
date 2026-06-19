/**
 * Campaigns tRPC router — persistent, owner-scoped campaigns (issue #2).
 *
 * A campaign is the unit of play; its mechanical state is event-sourced in
 * `engine_events` and rebuilt by the deterministic engine. This router owns the
 * campaign entity (create / list / get); the `engine` router owns the
 * per-campaign command/state surface.
 */
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { campaigns, getDb } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

/** Throw unless the campaign exists and belongs to the given user. */
export async function assertCampaignOwner(
  userId: string,
  campaignId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, userId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
  }
}

export const campaignsRouter = createTRPCRouter({
  /** Campaigns owned by the current user, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.ownerId, ctx.user.id))
      .orderBy(desc(campaigns.createdAt));
  }),

  /** Single owned campaign, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.id, input.id), eq(campaigns.ownerId, ctx.user.id)),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Create a campaign owned by the current user. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .insert(campaigns)
        .values({ ...input, ownerId: ctx.user.id })
        .returning();
      return row;
    }),
});
