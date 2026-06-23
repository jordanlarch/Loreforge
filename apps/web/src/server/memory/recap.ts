/**
 * Session recap generation + embedding (#145, MEM-4; `docs/data-sources.md` §6).
 *
 * When a session ends, its chat span is condensed into a recap and embedded as a
 * `session_recap` source so it grounds *future* sessions via RAG. Unlike the
 * transient rolling summary (MEM-3), a recap is a finalized, embeddable document.
 *
 * Two independent env gates, both best-effort:
 *   - generation needs `ANTHROPIC_API_KEY` (`@app/llm`); unconfigured → no recap.
 *   - embedding needs `OPENAI_API_KEY` (`@app/memory`); unconfigured → recorded
 *     but not embedded (recoverable later).
 * Neither failure breaks ending a session. The recap LLM only condenses prose —
 * the deterministic engine still owns all mechanics.
 */
import { eq } from "drizzle-orm";

import { sessions, type Database } from "@app/db";
import {
  createAnthropicClient,
  type EmitToolDefinition,
  type LlmClient,
  type LlmUsage,
} from "@app/llm";
import {
  SESSION_RECAP_SOURCE,
  contentHash,
  resolveEmbeddingClient,
  upsertSourceEmbeddings,
  type EmbeddingClient,
} from "@app/memory";

import { isEmbeddingConfigured } from "./embed";

/** Whether recap generation is configured (ANTHROPIC_API_KEY present). */
export function isRecapConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function resolveLlmClient(injected?: LlmClient): LlmClient | null {
  if (injected) return injected;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return createAnthropicClient({
    apiKey,
    defaultModel: process.env.ANTHROPIC_MODEL || undefined,
  });
}

const RECAP_TOOL: EmitToolDefinition = {
  name: "emit_recap",
  description: "Record a concise recap of the play session that just ended.",
  inputSchema: {
    type: "object",
    properties: {
      recap: {
        type: "string",
        description:
          "A concise recap (1-2 short paragraphs) of what happened this session: where the party went, the key events and decisions, NPCs met, and where things stand. Past tense, prose only — never include dice, numbers, HP, or mechanics.",
      },
    },
    required: ["recap"],
  },
};

const RECAP_SYSTEM = [
  "You are the chronicler for a Dungeons & Dragons 5E (SRD 5.2) campaign in the Loreforge app.",
  "Write a recap of the session that just ended, the kind a Game Master reads aloud to remind players 'previously, on…'.",
  "Capture the throughline — locations, key events, NPCs, decisions, and unresolved threads. Prose only; never include dice, numbers, HP, or mechanics.",
  "You MUST respond by calling the emit_recap tool.",
].join("\n");

export type GenerateRecapResult = { recap: string; model: string; usage: LlmUsage };

/**
 * Generate a recap from a session's transcript lines. Throws on empty output so
 * the caller can treat it as best-effort.
 */
export async function generateRecap(
  client: LlmClient,
  lines: readonly string[],
): Promise<GenerateRecapResult> {
  const prompt = [
    "Recap the following session transcript:",
    "",
    lines.join("\n"),
  ].join("\n");
  const res = await client.callTool({
    system: RECAP_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    tool: RECAP_TOOL,
  });
  const input = res.input as { recap?: unknown };
  const recap = typeof input.recap === "string" ? input.recap.trim() : "";
  if (!recap) throw new Error("Model returned an empty recap.");
  return { recap, model: res.model, usage: res.usage };
}

/**
 * Embed a recap as a `session_recap` source (campaign-scoped, owner-set), so it
 * is retrievable via RAG / `memory.search`. Best-effort: no-ops when embedding
 * is unconfigured (and no client injected); never throws.
 */
export async function embedRecapBestEffort(
  db: Database,
  args: {
    sessionId: string;
    campaignId: string;
    ownerId: string;
    recap: string;
    client?: EmbeddingClient;
  },
): Promise<void> {
  const client =
    args.client ?? (isEmbeddingConfigured() ? resolveEmbeddingClient() : null);
  if (!client) return;
  const text = args.recap.trim();
  if (!text) return;
  try {
    await upsertSourceEmbeddings(db, client, {
      ownerId: args.ownerId,
      campaignId: args.campaignId,
      sourceType: SESSION_RECAP_SOURCE,
      sourceId: args.sessionId,
      chunks: [{ chunkText: text, contentHash: contentHash(text) }],
    });
  } catch (error) {
    console.warn(
      `[memory] recap embed failed for session ${args.sessionId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export type RunRecapResult = { recap: string; model: string };

/**
 * Generate a recap for a session and embed it — the orchestrator the
 * `sessions.end` mutation and the `generate-recap` Trigger task share. Returns
 * the recap text + model (empty recap when generation is unconfigured/failed).
 * Best-effort throughout; never throws.
 */
export async function runRecap(
  db: Database,
  args: {
    sessionId: string;
    campaignId: string;
    ownerId: string;
    lines: readonly string[];
    llmClient?: LlmClient;
    embeddingClient?: EmbeddingClient;
  },
): Promise<RunRecapResult> {
  const client = resolveLlmClient(args.llmClient);
  if (!client || args.lines.length === 0) return { recap: "", model: "" };

  let recap = "";
  let model = "";
  try {
    const generated = await generateRecap(client, args.lines);
    recap = generated.recap;
    model = generated.model;
  } catch (error) {
    console.warn(
      `[memory] recap generation failed for session ${args.sessionId}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    return { recap: "", model: "" };
  }

  await embedRecapBestEffort(db, {
    sessionId: args.sessionId,
    campaignId: args.campaignId,
    ownerId: args.ownerId,
    recap,
    client: args.embeddingClient,
  });
  return { recap, model };
}

/**
 * {@link runRecap} + persist the recap onto the session row. The shared entry
 * point for both the inline `sessions.end` path and the durable `generate-recap`
 * Trigger task. Best-effort: a failed/empty recap leaves the session row's
 * default empty recap untouched.
 */
export async function runAndStoreRecap(
  db: Database,
  args: {
    sessionId: string;
    campaignId: string;
    ownerId: string;
    lines: readonly string[];
    llmClient?: LlmClient;
    embeddingClient?: EmbeddingClient;
  },
): Promise<RunRecapResult> {
  const result = await runRecap(db, args);
  if (result.recap) {
    await db
      .update(sessions)
      .set({ recap: result.recap, model: result.model })
      .where(eq(sessions.id, args.sessionId));
  }
  return result;
}
