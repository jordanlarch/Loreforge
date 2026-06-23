/**
 * Memory tRPC router — owner-scoped semantic retrieval over the embeddings store
 * (memory tier, MEM-2).
 *
 * `search` is the thin, reachable dogfood surface over `@app/memory`'s
 * `retrieveSimilar` primitive: it embeds the query and returns the top-k most
 * cosine-similar chunks the user owns. It is intentionally not yet wired into
 * generation (GEN-4) or live AI-GM turns (MEM-5) — those consumers plug into the
 * same seam later. Requires a configured embedding provider (`OPENAI_API_KEY`);
 * without one it reports `configured: false` and returns no results rather than
 * embedding queries against an empty table.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  campaigns,
  getDb,
  pinnedMemories,
  rollingSummaries,
  sessions,
} from "@app/db";
import { resolveEmbeddingClient, retrieveSimilar } from "@app/memory";

import { isEmbeddingConfigured } from "@/server/memory/embed";

import { createTRPCRouter, protectedProcedure } from "../init";
import { assertCampaignOwner } from "./campaigns";

export const memoryRouter = createTRPCRouter({
  /** Whether semantic search is configured (drives UI affordances). */
  status: protectedProcedure.query(() => ({
    configured: isEmbeddingConfigured(),
  })),

  /** Top-k owner-scoped semantic search over embedded sources. */
  search: protectedProcedure
    .input(
      z.object({
        queryText: z.string().trim().min(1).max(1000),
        sourceTypes: z.array(z.string().trim().max(40)).max(10).optional(),
        k: z.number().int().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!isEmbeddingConfigured()) {
        return { configured: false as const, results: [] };
      }
      const db = getDb();
      const client = resolveEmbeddingClient();
      const results = await retrieveSimilar(db, client, {
        ownerId: ctx.user.id,
        queryText: input.queryText,
        sourceTypes: input.sourceTypes,
        k: input.k ?? 8,
      });
      return { configured: true as const, results };
    }),

  /**
   * Export everything the memory tier holds for an owned campaign — the working
   * rolling summary (MEM-3), the finalized session recaps (MEM-4), and the
   * pinned memories (MEM-8) — as a portable, JSON-serializable document
   * (CAMP-10 memory export). Read-only; stored text only (not embeddings), so it
   * works regardless of `OPENAI_API_KEY`.
   */
  exportCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();

      const [campaign] = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          description: campaigns.description,
        })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId));
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
      }

      const [summary] = await db
        .select({
          summary: rollingSummaries.summary,
          coveredSeq: rollingSummaries.coveredSeq,
          updatedAt: rollingSummaries.updatedAt,
        })
        .from(rollingSummaries)
        .where(eq(rollingSummaries.campaignId, input.campaignId));

      const sessionRows = await db
        .select({
          id: sessions.id,
          startSeq: sessions.startSeq,
          endSeq: sessions.endSeq,
          recap: sessions.recap,
          model: sessions.model,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.campaignId, input.campaignId),
            eq(sessions.ownerId, ctx.user.id),
          ),
        )
        .orderBy(asc(sessions.endedAt));

      const pins = await db
        .select({
          id: pinnedMemories.id,
          content: pinnedMemories.content,
          createdAt: pinnedMemories.createdAt,
        })
        .from(pinnedMemories)
        .where(
          and(
            eq(pinnedMemories.campaignId, input.campaignId),
            eq(pinnedMemories.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(pinnedMemories.createdAt));

      return {
        exportedAt: new Date().toISOString(),
        campaign,
        rollingSummary: summary
          ? {
              summary: summary.summary,
              coveredSeq: summary.coveredSeq,
              updatedAt: summary.updatedAt,
            }
          : null,
        sessions: sessionRows,
        pinnedMemories: pins,
      };
    }),
});
