/**
 * Full-caster spell-slot progression (PHB) — the single source of truth for how
 * many slots a caster of a given level has, per spell level 1–9 (#40, E3).
 *
 * The foundation assumes a single full-caster class. Multiclass slot pooling,
 * half-casters (Paladin/Ranger), and Pact Magic (Warlock) are deferred (E4);
 * those will layer alternate tables on top of this same shape.
 */
import type { SpellSlots } from "../entities/types";

/**
 * Slots by caster level. Row `n` (1-indexed) is the slot counts for spell
 * levels 1..9 of a level-`n` full caster. Row 0 is the empty (sub-1) row.
 */
const FULL_CASTER_TABLE: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0 (non-caster / below level 1)
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

/**
 * The full-caster slot pools for a caster of `level`, as a fresh
 * {@link SpellSlots} with `current === max`. Levels are clamped to 1–20; a
 * level below 1 yields no slots. Only non-zero spell levels are included.
 */
export function fullCasterSlots(level: number): SpellSlots {
  const row = FULL_CASTER_TABLE[Math.max(0, Math.min(20, Math.floor(level)))]!;
  const slots: SpellSlots = {};
  row.forEach((count, index) => {
    if (count > 0) slots[index + 1] = { max: count, current: count };
  });
  return slots;
}
