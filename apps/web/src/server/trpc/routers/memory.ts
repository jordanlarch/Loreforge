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
import { z } from "zod";

import { getDb } from "@app/db";
import { resolveEmbeddingClient, retrieveSimilar } from "@app/memory";

import { isEmbeddingConfigured } from "@/server/memory/embed";

import { createTRPCRouter, protectedProcedure } from "../init";

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
});
