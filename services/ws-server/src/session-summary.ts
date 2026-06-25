/**
 * Rolling session summary (#143, MEM-3) — the memory tier's working-memory
 * layer (`docs/data-sources.md` §6 tier 3).
 *
 * The WS server is the authoritative live host that owns the turn loop and the
 * chat doc, so it regenerates the per-campaign session summary **inline**,
 * best-effort, every N turns — no Trigger.dev/runtime-key dependency (this
 * resolves the open MEM-3 "inline vs job" question in favor of inline). The
 * summary is injected into the AI-GM narration prompt (MEM-5) as a "story so
 * far" block. Env-gated on `ANTHROPIC_API_KEY`; no-ops offline so live play is
 * unchanged. The LLM only condenses prose — the deterministic engine still owns
 * all mechanics.
 */
import type { EmitToolDefinition, LlmClient } from "@app/llm";

import type { ChatEntry } from "./chat.js";
import {
  loadRollingSummary,
  saveRollingSummary,
  type RollingSummary,
} from "./db.js";
import { logLlmUsage, narrationModel, type LlmUsageContext } from "./llm-usage.js";

/** Regenerate the summary once this many new chat entries have accumulated. */
export const SUMMARY_EVERY = 8;

/** Cap on transcript lines fed to the summarizer (keeps the prompt bounded). */
const MAX_TRANSCRIPT_LINES = 40;

/** Whether rolling-summary generation is configured (ANTHROPIC_API_KEY present). */
export function isSummaryConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Whether the summary should be regenerated: true once the chat has grown by at
 * least `every` entries beyond what the current summary already covers.
 */
export function shouldRegenerateSummary(
  coveredSeq: number,
  currentLength: number,
  every: number = SUMMARY_EVERY,
): boolean {
  return currentLength - coveredSeq >= every;
}

/** "Author: text" lines for the player/GM entries fed to the summarizer. */
function transcriptLines(chat: readonly ChatEntry[]): string[] {
  return chat
    .filter((e) => e.kind === "player" || e.kind === "gm")
    .slice(-MAX_TRANSCRIPT_LINES)
    .map((e) => `${e.author}: ${e.text}`);
}

const SUMMARIZE_TOOL: EmitToolDefinition = {
  name: "summarize_session",
  description: "Record a concise running summary of the play session so far.",
  inputSchema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "A tight 3-6 sentence running summary of the session so far: where the party is, the key events and decisions, NPCs met, and current goals/threats. Present tense, prose only — never include dice, numbers, HP, or mechanics.",
      },
    },
    required: ["summary"],
  },
};

const SUMMARY_SYSTEM = [
  "You are the archivist for a Dungeons & Dragons 5E (SRD 5.2) session in the Loreforge app.",
  "Maintain a concise running summary of the session that the Game Master can read at a glance to stay consistent.",
  "Condense — capture the throughline (location, key events, NPCs, goals, threats), not a blow-by-blow. Prose only; never include dice, numbers, HP, or mechanics.",
  "You MUST respond by calling the summarize_session tool.",
].join("\n");

/**
 * Produce an updated running summary from the prior summary + recent transcript.
 * Throws on empty output so callers can treat it as best-effort.
 */
export async function summarizeSession(
  client: LlmClient,
  args: {
    priorSummary?: string;
    lines: readonly string[];
    usageCtx?: LlmUsageContext;
  },
): Promise<string> {
  const prior = args.priorSummary?.trim();
  const prompt = [
    prior ? `Summary so far:\n${prior}` : "There is no summary yet.",
    "",
    "Recent session transcript:",
    args.lines.join("\n"),
    "",
    prior
      ? "Update the running summary to fold in the new events. Keep it to 3-6 sentences."
      : "Write the running summary. Keep it to 3-6 sentences.",
  ].join("\n");

  const res = await client.callTool({
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    tool: SUMMARIZE_TOOL,
    model: narrationModel(),
  });

  if (args.usageCtx) {
    await logLlmUsage({
      ctx: args.usageCtx,
      model: res.model,
      usage: res.usage,
    });
  }
  const input = res.input as { summary?: unknown };
  const text = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!text) throw new Error("Model returned an empty session summary.");
  return text;
}

/** Injectable persistence seam for {@link maybeUpdateRollingSummary} (tests). */
export type RollingSummaryDeps = {
  load: (campaignId: string) => Promise<RollingSummary | null>;
  save: (
    campaignId: string,
    value: { summary: string; coveredSeq: number; model?: string },
  ) => Promise<void>;
};

const defaultDeps: RollingSummaryDeps = {
  load: loadRollingSummary,
  save: saveRollingSummary,
};

/**
 * Regenerate + persist the rolling summary when the cadence threshold is hit.
 * Best-effort: never throws, so a summarizer failure can't break the live turn.
 * `coveredSeq` is set to the current chat length, so the next regeneration waits
 * for another `SUMMARY_EVERY` turns.
 */
export async function maybeUpdateRollingSummary(args: {
  campaignId: string;
  client: LlmClient;
  /** The full current chat (from the live doc), after the latest turn. */
  chat: readonly ChatEntry[];
  usageCtx?: LlmUsageContext;
  deps?: RollingSummaryDeps;
}): Promise<void> {
  const deps = args.deps ?? defaultDeps;
  try {
    const length = args.chat.length;
    const existing = await deps.load(args.campaignId);
    if (!shouldRegenerateSummary(existing?.coveredSeq ?? 0, length)) return;

    const lines = transcriptLines(args.chat);
    if (lines.length === 0) return;

    const summary = await summarizeSession(args.client, {
      priorSummary: existing?.summary,
      lines,
      usageCtx: args.usageCtx,
    });
    await deps.save(args.campaignId, { summary, coveredSeq: length });
  } catch {
    // Best-effort: a summary refresh must never break the live channel.
  }
}
