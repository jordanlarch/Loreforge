/**
 * Smithy tRPC router — owner-scoped homebrew items (issue #4).
 *
 * First Smithy surface: create / list / get / delete custom items, scoped to the
 * signed-in Supabase user. Item taxonomy (type/rarity/source) is validated
 * against the shared `@app/engine` content constants so the DB, API, and UI
 * never drift. "Copy from Codex" provenance fields exist on the row but the copy
 * plumbing is stubbed until Codex items are ingested.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { ITEM_RARITIES, ITEM_SOURCES, ITEM_TYPES } from "@app/engine";
import { getDb, homebrewItems } from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

const itemType = z.enum(ITEM_TYPES);
const itemRarity = z.enum(ITEM_RARITIES);
const itemSource = z.enum(ITEM_SOURCES);

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: itemType,
  rarity: itemRarity.default("Common"),
  properties: z.array(z.string().trim().max(60)).max(20).default([]),
  description: z.string().trim().max(4000).default(""),
  requiresAttunement: z.boolean().default(false),
  source: itemSource.default("original"),
  copiedFromSlug: z.string().trim().max(160).optional(),
});

export const smithyRouter = createTRPCRouter({
  /** Homebrew items owned by the current user, newest first, optional type filter. */
  list: protectedProcedure
    .input(z.object({ type: itemType.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [
        eq(homebrewItems.ownerId, ctx.user.id),
        input?.type ? eq(homebrewItems.type, input.type) : undefined,
      ].filter(Boolean);
      return db
        .select()
        .from(homebrewItems)
        .where(and(...conditions))
        .orderBy(desc(homebrewItems.createdAt));
    }),

  /** Single owned item, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, input.id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Forge a new homebrew item owned by the current user. */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .insert(homebrewItems)
        .values({ ...input, ownerId: ctx.user.id })
        .returning();
      return row;
    }),

  /** Delete an owned item. Throws NOT_FOUND if it doesn't exist / isn't owned. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .delete(homebrewItems)
        .where(
          and(
            eq(homebrewItems.id, input.id),
            eq(homebrewItems.ownerId, ctx.user.id),
          ),
        )
        .returning({ id: homebrewItems.id });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      return { id: row.id };
    }),
});
