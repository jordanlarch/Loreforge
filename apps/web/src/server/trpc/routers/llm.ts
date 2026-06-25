import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";

import {
  generationEvents,
  getDb,
  llmUsageEvents,
} from "@app/db";
import { estimateLlmCostUsd } from "@app/llm";

import { createTRPCRouter, protectedProcedure } from "../init";

function sumCost(rows: { costUsd: string | null; inputTokens: number; outputTokens: number; model: string }[]) {
  let total = 0;
  for (const row of rows) {
    if (row.costUsd != null) {
      total += Number(row.costUsd);
      continue;
    }
    const est = estimateLlmCostUsd(row.model, {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
    });
    if (est != null) total += est;
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}

/** LLM cost observability — play usage + Realms generation (solo prod polish). */
export const llmRouter = createTRPCRouter({
  usageSummary: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid().optional(),
        days: z.number().int().min(1).max(90).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86_400_000);
      const db = getDb();
      const ownerId = ctx.user.id;

      const playWhere = input.campaignId
        ? and(
            eq(llmUsageEvents.ownerId, ownerId),
            eq(llmUsageEvents.campaignId, input.campaignId),
            gte(llmUsageEvents.createdAt, since),
          )
        : and(
            eq(llmUsageEvents.ownerId, ownerId),
            gte(llmUsageEvents.createdAt, since),
          );

      const playRows = await db
        .select({
          surface: llmUsageEvents.surface,
          model: llmUsageEvents.model,
          inputTokens: llmUsageEvents.inputTokens,
          outputTokens: llmUsageEvents.outputTokens,
          costUsd: llmUsageEvents.costUsd,
        })
        .from(llmUsageEvents)
        .where(playWhere);

      const genRows = await db
        .select({
          entityType: generationEvents.entityType,
          model: generationEvents.model,
          inputTokens: generationEvents.inputTokens,
          outputTokens: generationEvents.outputTokens,
          costUsd: generationEvents.costUsd,
        })
        .from(generationEvents)
        .where(
          and(
            eq(generationEvents.ownerId, ownerId),
            gte(generationEvents.createdAt, since),
          ),
        );

      const bySurface = new Map<string, { calls: number; costUsd: number }>();
      for (const row of playRows) {
        const bucket = bySurface.get(row.surface) ?? { calls: 0, costUsd: 0 };
        bucket.calls += 1;
        bucket.costUsd +=
          row.costUsd != null
            ? Number(row.costUsd)
            : (estimateLlmCostUsd(row.model, {
                inputTokens: row.inputTokens,
                outputTokens: row.outputTokens,
              }) ?? 0);
        bySurface.set(row.surface, bucket);
      }

      const playCost = sumCost(playRows);
      const generationCost = sumCost(genRows);
      const totalCost = Math.round((playCost + generationCost) * 1_000_000) / 1_000_000;

      return {
        days: input.days,
        playCalls: playRows.length,
        generationCalls: genRows.length,
        playCostUsd: playCost,
        generationCostUsd: generationCost,
        totalCostUsd: totalCost,
        bySurface: [...bySurface.entries()]
          .map(([surface, v]) => ({
            surface,
            calls: v.calls,
            costUsd: Math.round(v.costUsd * 1_000_000) / 1_000_000,
          }))
          .sort((a, b) => b.costUsd - a.costUsd),
        totalInputTokens:
          playRows.reduce((n, r) => n + r.inputTokens, 0) +
          genRows.reduce((n, r) => n + r.inputTokens, 0),
        totalOutputTokens:
          playRows.reduce((n, r) => n + r.outputTokens, 0) +
          genRows.reduce((n, r) => n + r.outputTokens, 0),
      };
    }),
});
