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

function gmEcho(mode: string | undefined, text: string): string {
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

/**
 * Compose the chat entries produced by one player input. A `/roll` slash yields
 * a single dice widget; an `((ooc))` line yields an out-of-character note; a
 * normal line yields the player entry plus a stubbed GM echo.
 */
export function composeChat(input: ChatInput, deps: ChatDeps): ChatEntry[] {
  const text = input.text.trim();
  if (text.length === 0) return [];
  const stamp = () => ({ id: deps.uuid(), ts: deps.now() });

  if (text.startsWith("/")) {
    const [rawCmd, ...rest] = text.slice(1).split(/\s+/);
    const cmd = (rawCmd ?? "").toLowerCase();
    if (cmd === "roll" || cmd === "r") {
      const roll = rollDice(rest.join("") || "1d20", deps.rng);
      if (roll) {
        return [
          {
            ...stamp(),
            kind: "roll",
            author: input.author,
            text: `rolled ${roll.notation}`,
            dice: roll,
          },
        ];
      }
    }
    if (cmd === "help") {
      return [
        {
          ...stamp(),
          kind: "event",
          author: "Engine",
          text: "Commands: /roll NdM±K · wrap ((text)) for out-of-character.",
        },
      ];
    }
    // Unknown slash falls through to a normal player line.
  }

  if (isOoc(text)) {
    return [
      { ...stamp(), kind: "ooc", author: input.author, text: stripOoc(text) },
    ];
  }

  return [
    { ...stamp(), kind: "player", author: input.author, mode: input.mode, text },
    { ...stamp(), kind: "gm", author: "GM", text: gmEcho(input.mode, text) },
  ];
}

/** A terse engine-event chat row for an accepted battle command. */
export function eventEntry(action: BattleAction, deps: ChatDeps): ChatEntry {
  let text: string;
  switch (action.type) {
    case "end_turn":
      text = "A combatant ended their turn.";
      break;
    case "move_entity":
      text = `A token moved to (${action.to.x}, ${action.to.y}).`;
      break;
    case "attack":
      text = "An attack was resolved by the engine.";
      break;
    case "opportunity_attack":
      text = "An opportunity attack was resolved by the engine.";
      break;
    case "cast_spell":
      text = `A spell (${action.spellId}) was cast.`;
      break;
    default:
      text = "The engine resolved an action.";
  }
  return { id: deps.uuid(), ts: deps.now(), kind: "event", author: "Engine", text };
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
