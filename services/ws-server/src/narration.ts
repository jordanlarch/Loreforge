/**
 * AI-GM narration (#96) — turns a player's input into Game Master prose.
 *
 * The deterministic engine owns ALL mechanics (Q12); the LLM here is a pure
 * storyteller. It is called from the server-authoritative chat handler after the
 * player's line is appended: given the live scene + recent chat, it returns
 * narration text plus the on-scene entity names it referenced (for @Entity
 * chips). Env-gated on `ANTHROPIC_API_KEY`; when unconfigured the caller falls
 * back to the stubbed `gmEcho`, so dev + tests run without a key or network.
 */
import {
  createAnthropicClient,
  type EmitToolDefinition,
  type LlmClient,
} from "@app/llm";
import type { WorldState } from "@app/engine";
import type { ChatEntry } from "./chat.js";

export type NarrationResult = { text: string; mentions: string[] };

/** Whether AI-GM narration is configured (ANTHROPIC_API_KEY present). */
export function isNarrationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: LlmClient | undefined;

/** The shared Anthropic client, or undefined when narration is unconfigured. */
export function getNarrationClient(): LlmClient | undefined {
  if (!isNarrationConfigured()) return undefined;
  if (!cachedClient) {
    cachedClient = createAnthropicClient({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel: process.env.ANTHROPIC_MODEL || undefined,
    });
  }
  return cachedClient;
}

const NARRATE_TOOL: EmitToolDefinition = {
  name: "narrate",
  description: "Narrate the Game Master's response to the players.",
  inputSchema: {
    type: "object",
    properties: {
      narration: {
        type: "string",
        description:
          "2-4 sentences of vivid, second-person Game Master narration that responds to the player's latest input and moves the scene forward. Describe fiction only — never roll dice, state numbers, or decide hit/miss.",
      },
      mentions: {
        type: "array",
        items: { type: "string" },
        description:
          "Names of on-scene entities you referenced, chosen ONLY from the provided entity list. Omit if none.",
      },
    },
    required: ["narration"],
  },
};

const SYSTEM_PROMPT = [
  "You are the Game Master (GM) for a Dungeons & Dragons 5E (SRD 5.2) session in the Loreforge app.",
  "Narrate vividly in the second person ('you'), responding to the players' latest input and nudging the scene forward.",
  "You are a storyteller, not a rules calculator: the app's deterministic engine owns ALL mechanics (dice, hit/miss, damage, HP, conditions). Never roll dice, quote numbers, or decide success/failure — describe the fiction and let the engine resolve mechanics.",
  "Keep it tight (2-4 sentences) and stay consistent with the scene and the entities present.",
  "You MUST respond by calling the narrate tool.",
].join("\n");

/** Distinct entity names in the current scene — the closed set for mentions. */
function sceneEntityNames(state: WorldState | undefined): string[] {
  if (!state) return [];
  const sceneId = state.currentSceneId;
  const names = new Set<string>();
  for (const entity of Object.values(state.entities)) {
    if (sceneId && entity.sceneId && entity.sceneId !== sceneId) continue;
    names.add(entity.name);
  }
  return [...names];
}

function sceneSummary(state: WorldState | undefined): string {
  if (!state) return "";
  const scene = state.currentSceneId
    ? state.scenes[state.currentSceneId]
    : undefined;
  if (!scene) return "";
  return scene.description ? `${scene.name} — ${scene.description}` : scene.name;
}

/** "Author: text" lines for the last few non-event chat entries. */
function recentLines(chat: readonly ChatEntry[], limit = 8): string[] {
  return chat
    .filter((e) => e.kind === "player" || e.kind === "gm")
    .slice(-limit)
    .map((e) => `${e.author}: ${e.text}`);
}

const MODE_VERB: Record<string, string> = {
  speak: "says",
  action: "attempts an action",
  check: "attempts a check",
  cast: "casts a spell",
  attack: "attacks",
  use_item: "uses an item",
};

/**
 * Produce a GM narration for one player input. Throws on transport/empty-output
 * failures so the caller can fall back to the stub. Returned `mentions` are
 * filtered to the closed set of on-scene entity names (the model is told to pick
 * from that list, and we enforce it).
 */
export async function narrate(args: {
  client: LlmClient;
  state: WorldState | undefined;
  recentChat: readonly ChatEntry[];
  playerLine: string;
  mode?: string;
}): Promise<NarrationResult> {
  const names = sceneEntityNames(args.state);
  const scene = sceneSummary(args.state);
  const history = recentLines(args.recentChat);
  const verb = (args.mode && MODE_VERB[args.mode]) || "says";

  const prompt = [
    scene ? `Scene: ${scene}` : "",
    names.length > 0 ? `Entities present: ${names.join(", ")}.` : "",
    history.length > 0 ? `Recent exchange:\n${history.join("\n")}` : "",
    "",
    `The player ${verb}: "${args.playerLine.trim()}"`,
    "Narrate the GM's response.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await args.client.callTool({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    tool: NARRATE_TOOL,
  });

  const input = res.input as { narration?: unknown; mentions?: unknown };
  const text = typeof input.narration === "string" ? input.narration.trim() : "";
  if (!text) throw new Error("Model returned empty narration.");

  const known = new Set(names.map((n) => n.toLowerCase()));
  const mentions = Array.isArray(input.mentions)
    ? [
        ...new Set(
          input.mentions.filter(
            (m): m is string =>
              typeof m === "string" && known.has(m.toLowerCase()),
          ),
        ),
      ]
    : [];

  return { text, mentions };
}
