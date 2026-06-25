import { estimateLlmCostUsd, type LlmUsage } from "@app/llm";
import { getDb, llmUsageEvents, type LlmUsageSurface } from "@app/db";

export type LlmUsageContext = {
  ownerId: string;
  campaignId?: string | null;
  surface: LlmUsageSurface;
};

/** Cheaper model for routing/classifier orchestrators (check, target pick). */
export function routingModel(): string | undefined {
  return (
    process.env.ANTHROPIC_MODEL_ROUTING ||
    process.env.ANTHROPIC_MODEL ||
    undefined
  );
}

/** Primary narration model override. */
export function narrationModel(): string | undefined {
  return (
    process.env.ANTHROPIC_MODEL_NARRATION ||
    process.env.ANTHROPIC_MODEL ||
    undefined
  );
}

/** Persist one LLM call for cost observability. Never throws. */
export async function logLlmUsage(args: {
  ctx: LlmUsageContext;
  model: string;
  usage: LlmUsage;
  status?: "success" | "error";
}): Promise<void> {
  try {
    const costUsd = estimateLlmCostUsd(args.model, args.usage);
    await getDb()
      .insert(llmUsageEvents)
      .values({
        ownerId: args.ctx.ownerId,
        campaignId: args.ctx.campaignId ?? null,
        surface: args.ctx.surface,
        model: args.model,
        inputTokens: args.usage.inputTokens,
        outputTokens: args.usage.outputTokens,
        costUsd: costUsd != null ? String(costUsd) : null,
        status: args.status ?? "success",
      });
  } catch {
    // Audit logging must never break live play.
  }
}
