/**
 * Live-play chat — browser-safe types + composer helpers (#57).
 *
 * Mirrors the server's `services/ws-server/src/chat.ts` entry contract (the two
 * are kept in sync by convention, like the battle projection mapping). The
 * server is authoritative: the composer here only classifies input for styling
 * and ships the raw text + mode over the stateless channel.
 */

export type ChatEntryKind = "gm" | "player" | "event" | "roll" | "ooc";

export interface DiceRoll {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
}

export interface ChatEntry {
  id: string;
  kind: ChatEntryKind;
  author: string;
  mode?: string;
  text: string;
  dice?: DiceRoll;
  ts: number;
}

/** Player input modes shown as the composer's mode toggle (#57). */
export const INPUT_MODES = [
  { id: "speak", label: "Speak" },
  { id: "action", label: "Action" },
  { id: "check", label: "Check" },
  { id: "cast", label: "Cast" },
  { id: "attack", label: "Attack" },
  { id: "use_item", label: "Use Item" },
] as const;

export type InputModeId = (typeof INPUT_MODES)[number]["id"];

export const DEFAULT_INPUT_MODE: InputModeId = "speak";

/** How a raw composer line will be interpreted by the server. */
export type ComposerIntent =
  | { kind: "slash"; command: string }
  | { kind: "ooc" }
  | { kind: "message" }
  | { kind: "empty" };

/**
 * Classify a raw composer line for live styling/hints (the server re-derives the
 * authoritative result). `/cmd` → slash, `((…))` → out-of-character, otherwise a
 * normal moded message. Pure + unit-testable.
 */
export function classifyComposerInput(raw: string): ComposerIntent {
  const text = raw.trim();
  if (text.length === 0) return { kind: "empty" };
  if (text.startsWith("/")) {
    const command = text.slice(1).split(/\s+/)[0]?.toLowerCase() ?? "";
    return { kind: "slash", command };
  }
  if (text.startsWith("((") && text.endsWith("))") && text.length > 4) {
    return { kind: "ooc" };
  }
  return { kind: "message" };
}

/** Human label for an entry's mode, if any. */
export function modeLabel(mode: string | undefined): string | undefined {
  return INPUT_MODES.find((m) => m.id === mode)?.label;
}
