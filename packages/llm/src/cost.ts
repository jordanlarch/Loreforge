import type { LlmUsage } from "./client.js";

/** USD per 1M tokens — best-effort snapshot; update when providers reprice. */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
};

const DEFAULT_RATE = { input: 3, output: 15 };

function ratesFor(model: string) {
  if (MODEL_RATES[model]) return MODEL_RATES[model]!;
  const prefix = Object.keys(MODEL_RATES).find((k) => model.startsWith(k));
  return prefix ? MODEL_RATES[prefix]! : DEFAULT_RATE;
}

/** Estimate USD cost from token usage. Returns null when usage is zero. */
export function estimateLlmCostUsd(
  model: string,
  usage: LlmUsage,
): number | null {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return null;
  const rate = ratesFor(model);
  const usd =
    (usage.inputTokens / 1_000_000) * rate.input +
    (usage.outputTokens / 1_000_000) * rate.output;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
