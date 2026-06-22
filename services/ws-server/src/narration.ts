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
import type { Ability, EntityState, WorldState } from "@app/engine";
import type { ChatEntry } from "./chat.js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

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

const ABILITY_LABEL: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Human label for an ability ("Wisdom"). */
export function abilityLabel(ability: Ability): string {
  return ABILITY_LABEL[ability];
}

/**
 * The party member a free-text check should be resolved against (#97): the
 * active combatant when it's a PC, otherwise the first character in the current
 * scene. Returns undefined when no PC is present (caller narrates instead).
 */
export function activePlayerEntity(
  state: WorldState | undefined,
): EntityState | undefined {
  if (!state) return undefined;
  const enc = state.encounter;
  if (enc?.initiativeRolled && enc.order.length > 0) {
    const activeRef = enc.order[enc.activeIndex]?.entity;
    const active = activeRef ? state.entities[activeRef] : undefined;
    if (active?.kind === "character") return active;
  }
  const sceneId = state.currentSceneId;
  return Object.values(state.entities).find(
    (e) =>
      e.kind === "character" &&
      e.alive &&
      (!sceneId || !e.sceneId || e.sceneId === sceneId),
  );
}

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
  /** Mechanical result the engine already resolved (e.g. an ability check) that
   * the narration must honour rather than re-decide (#97). */
  outcome?: string;
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
    args.outcome
      ? `The dice have already decided the outcome: ${args.outcome} Narrate what happens, honouring this result exactly — do not contradict it or roll again.`
      : "Narrate the GM's response.",
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

/* -------------------------------------------------------------------------- *
 *  Orchestrator — turn a free-text "Check" into a structured engine command
 * -------------------------------------------------------------------------- */

export type CheckDecision = {
  ability: Ability;
  skill?: string;
  dc: number;
  proficient: boolean;
};

const CALL_FOR_CHECK_TOOL: EmitToolDefinition = {
  name: "call_for_check",
  description: "Decide which ability check the player's attempt requires.",
  inputSchema: {
    type: "object",
    properties: {
      ability: {
        type: "string",
        enum: [...ABILITIES],
        description: "The governing ability for this check.",
      },
      skill: {
        type: "string",
        description:
          "SRD skill or tool the check uses (e.g. Perception, Athletics, Persuasion, Arcana). Omit for a raw ability check.",
      },
      dc: {
        type: "integer",
        minimum: 1,
        maximum: 30,
        description:
          "Difficulty class: 5 trivial, 10 easy, 15 moderate, 20 hard, 25 very hard, 30 nearly impossible.",
      },
      proficient: {
        type: "boolean",
        description:
          "Whether a typical adventurer attempting this would add their proficiency bonus.",
      },
    },
    required: ["ability", "dc"],
  },
};

const DECIDE_SYSTEM = [
  "You are the Game Master adjudicating a Dungeons & Dragons 5E (SRD 5.2) ability check.",
  "Given the player's attempted action, choose the single most appropriate ability, an optional skill, and a difficulty class proportional to how hard the task is.",
  "You decide the difficulty only — the deterministic engine rolls the dice and the bonuses. You MUST respond by calling the call_for_check tool.",
].join("\n");

/**
 * The orchestrator step (#97): ask the model which ability/skill + DC a free-text
 * "Check" attempt calls for. The engine then rolls it deterministically — the
 * model never sees or invents the result. Output is clamped to a valid ability
 * and a 1-30 DC so a malformed payload can't reach the engine.
 */
export async function decideCheck(args: {
  client: LlmClient;
  state: WorldState | undefined;
  playerLine: string;
}): Promise<CheckDecision> {
  const scene = sceneSummary(args.state);
  const prompt = [
    scene ? `Scene: ${scene}` : "",
    `The player attempts: "${args.playerLine.trim()}"`,
    "What ability check does this call for?",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await args.client.callTool({
    system: DECIDE_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    tool: CALL_FOR_CHECK_TOOL,
  });

  const input = res.input as {
    ability?: unknown;
    skill?: unknown;
    dc?: unknown;
    proficient?: unknown;
  };
  const ability = ABILITIES.includes(input.ability as Ability)
    ? (input.ability as Ability)
    : "wis";
  const dcRaw = typeof input.dc === "number" ? Math.round(input.dc) : 12;
  const dc = Math.max(1, Math.min(30, dcRaw));
  const skill =
    typeof input.skill === "string" && input.skill.trim()
      ? input.skill.trim()
      : undefined;
  const proficient = input.proficient === true;

  return { ability, skill, dc, proficient };
}
