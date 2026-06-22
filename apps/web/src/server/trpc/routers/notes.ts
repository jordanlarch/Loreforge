/**
 * Campaign Notes tRPC router — a campaign-scoped DM scratchpad (#118, CAMP-9).
 *
 * Each note has a title, a body, and a `shared` flag (DM-only vs visible to
 * players). All procedures are owner-scoped via `assertCampaignOwner` plus
 * owner-filtered writes. `@Entity` autolink, convert-to-hook, and pin-to-memory
 * are deferred follow-ups.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { campaignNotes, getDb } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

export const notesRouter = createTRPCRouter({
  /** All notes for an owned campaign, most recently updated first. */
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select()
        .from(campaignNotes)
        .where(
          and(
            eq(campaignNotes.campaignId, input.campaignId),
            eq(campaignNotes.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(campaignNotes.updatedAt));
    }),

  /** Create a note in the campaign. */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        title: z.string().trim().max(200).default(""),
        body: z.string().trim().max(20000).default(""),
        shared: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [row] = await db
        .insert(campaignNotes)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          title: input.title,
          body: input.body,
          shared: input.shared,
        })
        .returning();
      return row;
    }),

  /** Patch a note's editable fields (owner-scoped). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().max(200).optional(),
        body: z.string().trim().max(20000).optional(),
        shared: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...patch } = input;
      const [row] = await db
        .update(campaignNotes)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(campaignNotes.id, id), eq(campaignNotes.ownerId, ctx.user.id)),
        )
        .returning();
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found." });
      }
      return row;
    }),

  /** Delete a note (owner-scoped, idempotent). */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(campaignNotes)
        .where(
          and(
            eq(campaignNotes.id, input.id),
            eq(campaignNotes.ownerId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
