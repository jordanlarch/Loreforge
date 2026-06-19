/**
 * Dice service — deterministic 5E dice rolling.
 *
 * Parses standard dice notation (`2d6+3`, `1d20`, `8d6`, `4d6kh3`) and resolves
 * rolls against a seeded {@link Rng}. The engine resolves randomness once, at
 * command time, and records the concrete results in events (see
 * `DiceRolledEvent`), so replay never needs to re-roll — it just reads the
 * recorded values. Tests pin behaviour via fixed seeds.
 *
 * @see docs/engine/architecture.md §3 (event-sourced randomness)
 */
import { randomInt, type Rng } from "./prng";

export type DiceNotation = string;

export type RollMode = "normal" | "advantage" | "disadvantage";

export type ParsedDice = {
  /** Number of dice rolled. */
  count: number;
  /** Faces per die (e.g. 20 for d20). */
  sides: number;
  /** Flat modifier added to the sum. */
  modifier: number;
  /** Keep-highest N dice (e.g. `4d6kh3`); undefined keeps all. */
  keepHighest?: number;
  /** Keep-lowest N dice; undefined keeps all. */
  keepLowest?: number;
};

export type DiceRoll = {
  notation: DiceNotation;
  /** Every die face rolled, in order. */
  rolls: number[];
  /** Faces actually counted after keep-highest/lowest filtering. */
  kept: number[];
  modifier: number;
  /** Sum of kept dice + modifier. */
  total: number;
};

const DICE_PATTERN = /^\s*(\d*)d(\d+)\s*(?:(kh|kl)(\d+))?\s*([+-]\s*\d+)?\s*$/i;

/** Parse dice notation into structured components. Throws on malformed input. */
export function parseDice(notation: DiceNotation): ParsedDice {
  const match = DICE_PATTERN.exec(notation);
  if (!match) {
    throw new Error(`Invalid dice notation: "${notation}"`);
  }
  const countRaw = match[1] ?? "";
  const count = countRaw === "" ? 1 : Number.parseInt(countRaw, 10);
  const sides = Number.parseInt(match[2]!, 10);
  const keepKind = match[3]?.toLowerCase();
  const keepN = match[4] != null ? Number.parseInt(match[4], 10) : undefined;
  const modifier = match[5]
    ? Number.parseInt(match[5].replace(/\s+/g, ""), 10)
    : 0;

  if (count < 1) throw new Error(`Dice count must be >= 1: "${notation}"`);
  if (sides < 1) throw new Error(`Dice sides must be >= 1: "${notation}"`);
  if (keepN != null && keepN > count) {
    throw new Error(`Cannot keep ${keepN} of ${count} dice: "${notation}"`);
  }

  return {
    count,
    sides,
    modifier,
    keepHighest: keepKind === "kh" ? keepN : undefined,
    keepLowest: keepKind === "kl" ? keepN : undefined,
  };
}

function applyKeep(rolls: number[], parsed: ParsedDice): number[] {
  if (parsed.keepHighest != null) {
    return [...rolls].sort((a, b) => b - a).slice(0, parsed.keepHighest);
  }
  if (parsed.keepLowest != null) {
    return [...rolls].sort((a, b) => a - b).slice(0, parsed.keepLowest);
  }
  return rolls;
}

/** Roll a dice notation against a seeded RNG, returning a structured result. */
export function rollDice(notation: DiceNotation, rng: Rng): DiceRoll {
  const parsed = parseDice(notation);
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(randomInt(rng, 1, parsed.sides));
  }
  const kept = applyKeep(rolls, parsed);
  const total = kept.reduce((sum, n) => sum + n, 0) + parsed.modifier;
  return { notation, rolls, kept, modifier: parsed.modifier, total };
}

/**
 * Roll a single d20 with optional advantage/disadvantage, plus a flat bonus.
 * Used for attacks, saves, and ability checks.
 */
export function rollD20(
  rng: Rng,
  options: { mode?: RollMode; bonus?: number } = {},
): { rolls: number[]; natural: number; total: number; mode: RollMode } {
  const mode = options.mode ?? "normal";
  const bonus = options.bonus ?? 0;
  const first = randomInt(rng, 1, 20);
  if (mode === "normal") {
    return { rolls: [first], natural: first, total: first + bonus, mode };
  }
  const second = randomInt(rng, 1, 20);
  const natural =
    mode === "advantage"
      ? Math.max(first, second)
      : Math.min(first, second);
  return { rolls: [first, second], natural, total: natural + bonus, mode };
}
