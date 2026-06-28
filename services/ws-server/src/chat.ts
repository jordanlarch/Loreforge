/**
 * Live-play narrative chat (#57) — server-authoritative chat log.
 *
 * Chat rides the same Hocuspocus doc as the battle projection but in its own
 * top-level Y.Array (`chat`), so {@link writeProjection} never touches it. The
 * server is the sole writer (clients are observers + stateless senders, per
 * `docs/engine/architecture.md` §10): a client sends `{ t: "chat", mode, text }`
 * and the server stamps id/timestamp/author and appends the resulting entries.
 *
 * AI-GM orchestration is stubbed for this slice (an echo "GM" line); real
 * narration lands later. `/roll` is a chat dice utility — true mechanical checks
 * route through the deterministic engine in the combat-loop slice (#58).
 *
 * The client mirrors {@link ChatEntry} in `apps/web/src/lib/live-chat.ts`; keep
 * the two field contracts in sync (same convention as the projection mapping).
 */
import * as Y from "yjs";
import type { BattleAction } from "@app/engine";

/** Top-level Y.Array field name on the shared battle doc. */
export const CHAT = "chat";

export type ChatEntryKind = "gm" | "player" | "event" | "roll" | "ooc";

/** A resolved dice expression rendered as a structured widget. */
export interface DiceRoll {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
}

export interface ChatEntry {
  id: string;
  kind: ChatEntryKind;
  /** Display label of the speaker ("GM", "Engine", or a player name). */
  author: string;
  /** Player input mode (speak/action/check/cast/attack/use_item), if any. */
  mode?: string;
  text: string;
  dice?: DiceRoll;
  /** World-entity names the GM referenced (@Entity chips, #96). */
  mentions?: string[];
  ts: number;
}

/** Incoming, untrusted chat payload from a client. */
export interface ChatInput {
  author: string;
  mode?: string;
  text: string;
}

/** Stamping dependencies, injected so the composers are pure + testable. */
export interface ChatDeps {
  uuid: () => string;
  now: () => number;
  rng?: () => number;
}

export function chatArray(doc: Y.Doc): Y.Array<ChatEntry> {
  return doc.getArray<ChatEntry>(CHAT);
}

/** Append entries to the shared chat log in a single transaction. */
export function appendChat(doc: Y.Doc, entries: ChatEntry[]): void {
  if (entries.length === 0) return;
  doc.transact(() => chatArray(doc).push(entries));
}

/** Empty the shared chat log (backs the tutorial "Reset" clearing the window). */
export function clearChat(doc: Y.Doc): void {
  const arr = chatArray(doc);
  if (arr.length === 0) return;
  doc.transact(() => arr.delete(0, arr.length));
}

/** Replace the in-memory chat log with persisted history (no duplicate rows on reconnect). */
export function replaceChat(doc: Y.Doc, entries: ChatEntry[]): void {
  clearChat(doc);
  appendChat(doc, entries);
}

const DICE_RE = /^(\d{1,3})?d(\d{1,3})([+-]\d{1,4})?$/i;

/**
 * Roll a `NdM±K` expression (N optional → 1, K optional → 0). Returns null for
 * malformed or out-of-bounds notation. RNG is injectable for deterministic
 * tests; defaults to `Math.random` (a narrative utility roll, not engine math).
 */
export function rollDice(
  notation: string,
  rng: () => number = Math.random,
): DiceRoll | null {
  const match = DICE_RE.exec(notation.trim());
  if (!match) return null;
  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = Number.parseInt(match[2]!, 10);
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  const rolls: number[] = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(1 + Math.floor(rng() * sides));
  }
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return { notation: `${count}d${sides}${sign}`, rolls, modifier, total };
}

/** Out-of-character text is wrapped in double parentheses: `((aside))`. */
export function isOoc(text: string): boolean {
  const t = text.trim();
  return t.startsWith("((") && t.endsWith("))") && t.length > 4;
}

export function stripOoc(text: string): string {
  return text.trim().slice(2, -2).trim();
}

/** Stubbed GM line used when AI-GM narration is unconfigured or fails (#96). */
export function gmEcho(mode: string | undefined, text: string): string {
  switch (mode) {
    case "action":
      return `The GM weighs your action and the scene shifts in answer.`;
    case "check":
      return `The GM calls for resolve as you test your luck.`;
    case "cast":
      return `Arcane words take shape; the GM narrates the spell's effect.`;
    case "attack":
      return `Steel meets the moment — the GM resolves your strike.`;
    case "use_item":
      return `The GM notes what you produce and how the scene responds.`;
    default:
      return `“${text.slice(0, 80)}” — the GM weaves your words into the tale.`;
  }
}

/** The immediate entries a player input produces + whether the GM responds. */
export interface ComposedInput {
  entries: ChatEntry[];
  /**
   * True when a GM narration should follow (a normal moded line). Slash, OOC,
   * roll, and empty inputs are self-contained and get no GM response. The GM
   * entry is produced asynchronously by the caller (real narration or the stub)
   * so this stays pure + synchronous.
   */
  respond: boolean;
}

/**
 * Compose the *immediate* entries for one player input (#96). A `/roll` slash
 * yields a dice widget; `((ooc))` an out-of-character note; `/help` an engine
 * hint; a normal line yields the player entry and flags `respond` so the caller
 * can append a GM narration. Pure + synchronous — the async GM call lives in the
 * caller, since narration needs the LLM + world context.
 */
export function composePlayerInput(
  input: ChatInput,
  deps: ChatDeps,
): ComposedInput {
  const text = input.text.trim();
  if (text.length === 0) return { entries: [], respond: false };
  const stamp = () => ({ id: deps.uuid(), ts: deps.now() });

  if (text.startsWith("/")) {
    const [rawCmd, ...rest] = text.slice(1).split(/\s+/);
    const cmd = (rawCmd ?? "").toLowerCase();
    if (cmd === "roll" || cmd === "r") {
      const roll = rollDice(rest.join("") || "1d20", deps.rng);
      if (roll) {
        return {
          entries: [
            {
              ...stamp(),
              kind: "roll",
              author: input.author,
              text: `rolled ${roll.notation}`,
              dice: roll,
            },
          ],
          respond: false,
        };
      }
    }
    if (cmd === "help") {
      return {
        entries: [
          {
            ...stamp(),
            kind: "event",
            author: "Engine",
            text: "Commands: /roll NdM±K · wrap ((text)) for out-of-character.",
          },
        ],
        respond: false,
      };
    }
    // Unknown slash falls through to a normal player line.
  }

  if (isOoc(text)) {
    return {
      entries: [
        { ...stamp(), kind: "ooc", author: input.author, text: stripOoc(text) },
      ],
      respond: false,
    };
  }

  return {
    entries: [
      {
        ...stamp(),
        kind: "player",
        author: input.author,
        mode: input.mode,
        text,
      },
    ],
    respond: true,
  };
}

/** An engine-event row summarizing a resolved ability check (#97). */
export function checkEntry(
  args: {
    actorName: string;
    abilityLabel: string;
    skill?: string;
    total: number;
    dc: number;
    success: boolean;
  },
  deps: ChatDeps,
): ChatEntry {
  const skillPart = args.skill ? ` (${args.skill})` : "";
  const verdict = args.success ? "Success" : "Failure";
  return {
    id: deps.uuid(),
    ts: deps.now(),
    kind: "event",
    author: "Engine",
    text: `${args.actorName} — ${args.abilityLabel}${skillPart} check: ${args.total} vs DC ${args.dc} → ${verdict}`,
  };
}

/** A GM chat entry (real narration or the {@link gmEcho} stub), with mentions. */
export function gmEntry(
  text: string,
  deps: ChatDeps,
  opts?: { mentions?: readonly string[] },
): ChatEntry {
  return {
    id: deps.uuid(),
    ts: deps.now(),
    kind: "gm",
    author: "GM",
    text,
    ...(opts?.mentions && opts.mentions.length > 0
      ? { mentions: [...opts.mentions] }
      : {}),
  };
}

/** A terse engine-event chat row for an accepted battle command. */
/** The terse, command-level description (no resolution detail). */
function eventText(action: BattleAction): string {
  switch (action.type) {
    case "end_turn":
      return "A combatant ended their turn.";
    case "move_entity":
      return `A token moved to (${action.to.x}, ${action.to.y}).`;
    case "attack":
      return "An attack was resolved by the engine.";
    case "opportunity_attack":
      return "An opportunity attack was resolved by the engine.";
    case "ready_action":
      return "A combatant readied an action.";
    case "trigger_readied":
      return "A readied action was triggered.";
    case "ability_check":
      return "A check was resolved by the engine.";
    case "cast_spell":
      return `A spell (${action.spellId}) was cast.`;
    case "detect_trap":
      return "A Perception check was made to detect a trap.";
    case "disable_trap":
      return "A check was made to disable a trap.";
    default:
      return "The engine resolved an action.";
  }
}

export function eventEntry(action: BattleAction, deps: ChatDeps): ChatEntry {
  return {
    id: deps.uuid(),
    ts: deps.now(),
    kind: "event",
    author: "Engine",
    text: eventText(action),
  };
}

/** The shape of an engine `CommandSummary` we read for resolution detail (#99). */
export type ResolutionSummary = Record<string, unknown> | undefined;

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/**
 * Build a *resolution-detail* line from the engine's command summary (#99): the
 * attack/save roll outcome + damage, rather than the terse "an attack was
 * resolved" row. Returns undefined when the summary lacks resolution fields, so
 * the caller can fall back to {@link eventText}.
 */
function resolutionText(
  action: BattleAction,
  summary: ResolutionSummary,
  nameOf: (id: string) => string,
): string | undefined {
  if (!summary) return undefined;

  if (action.type === "ready_action") {
    const entity = nameOf(action.entity);
    const target = nameOf(action.action.target);
    return `${entity} readies an attack against ${target}.`;
  }

  if (
    action.type === "attack" ||
    action.type === "opportunity_attack" ||
    action.type === "trigger_readied"
  ) {
    const attacker = nameOf(String(summary.attacker ?? ""));
    const target = nameOf(String(summary.target ?? ""));
    const total = num(summary.attackTotal);
    const ac = num(summary.targetAc);
    if (total === undefined || ac === undefined) return undefined;
    const prefix =
      action.type === "opportunity_attack"
        ? "Opportunity — "
        : action.type === "trigger_readied"
          ? "Readied — "
          : "";
    const vs = `${total} vs AC ${ac}`;
    if (summary.hit !== true) {
      return `${prefix}${attacker} misses ${target} (${vs}).`;
    }
    const crit = summary.critical === true ? " critical!" : "";
    const dmg = num(summary.damage) ?? 0;
    const type = String(summary.damageType ?? "damage");
    const downed = summary.downed === true ? `, dropping ${target}` : "";
    return `${prefix}${attacker} hits ${target} (${vs})${crit} — ${dmg} ${type}${downed}.`;
  }

  if (action.type === "cast_spell") {
    const caster = nameOf(String(summary.caster ?? ""));
    const spell = String(summary.spellName ?? "a spell");
    // Save-based spell (Fireball, Burning Hands, Sacred Flame).
    if ("save" in summary && summary.save !== undefined) {
      const targets = num(summary.targets) ?? 0;
      if (targets === 0) {
        return `${caster} casts ${spell} — no creatures caught.`;
      }
      const failures = num(summary.failures) ?? 0;
      const dc = num(summary.dc);
      const ability = String(summary.save).toUpperCase();
      const dmg = num(summary.damage) ?? 0;
      const save = dc !== undefined ? `${ability} save DC ${dc}` : `${ability} save`;
      return `${caster} casts ${spell} — ${failures}/${targets} failed the ${save}; ${dmg} total damage.`;
    }
    // Single-target spell attack (Guiding Bolt).
    if ("hit" in summary) {
      const target = nameOf(String(summary.target ?? ""));
      if (summary.hit !== true) {
        return `${caster} casts ${spell} — misses ${target}.`;
      }
      const crit = summary.critical === true ? " critical!" : "";
      const dmg = num(summary.damage) ?? 0;
      return `${caster} casts ${spell} — hits ${target}${crit} for ${dmg} damage.`;
    }
    return `${caster} casts ${spell}.`;
  }

  return undefined;
}

/**
 * An engine event row enriched with resolution detail when the summary carries
 * it (#99), falling back to the terse command description otherwise.
 */
export function resolutionEntry(
  action: BattleAction,
  summary: ResolutionSummary,
  nameOf: (id: string) => string,
  deps: ChatDeps,
): ChatEntry {
  return {
    id: deps.uuid(),
    ts: deps.now(),
    kind: "event",
    author: "Engine",
    text: resolutionText(action, summary, nameOf) ?? eventText(action),
  };
}

/** Validate an untrusted chat payload shape. */
export function isChatInput(
  value: unknown,
): value is { mode?: string; text: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { text?: unknown; mode?: unknown };
  return (
    typeof v.text === "string" &&
    v.text.length > 0 &&
    v.text.length <= 2000 &&
    (v.mode === undefined || typeof v.mode === "string")
  );
}
