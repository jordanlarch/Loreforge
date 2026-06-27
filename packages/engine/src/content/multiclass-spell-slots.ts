/**
 * Multiclass spell-slot pooling (PHB) — full + half casters combine into one
 * slot table via effective caster level. Warlock Pact Magic and third-caster
 * archetypes remain deferred; see spell-slots.ts.
 */
import type { SpellSlots } from "../entities/types";
import { fullCasterSlots } from "./spell-slots";

const FULL_CASTERS = new Set([
  "Bard",
  "Cleric",
  "Druid",
  "Sorcerer",
  "Wizard",
]);

const HALF_CASTERS = new Set(["Paladin", "Ranger"]);

/**
 * Effective caster level for the combined slot table (PHB multiclassing).
 * Full casters contribute their level; half casters contribute floor(level / 2).
 */
export function multiclassCasterLevel(
  classes: { class: string; level: number }[],
): number {
  let total = 0;
  for (const cl of classes) {
    if (FULL_CASTERS.has(cl.class)) total += cl.level;
    else if (HALF_CASTERS.has(cl.class)) total += Math.floor(cl.level / 2);
  }
  return total;
}

/** Spell slot maxima for a multiclass character's class list. */
export function spellSlotsForClasses(
  classes: { class: string; level: number }[],
): SpellSlots {
  return fullCasterSlots(multiclassCasterLevel(classes));
}

/** Sheet-friendly slot pools keyed by spell level string. */
/** True when the class list contributes pooled slots or Warlock pact magic. */
export function isSpellcastingClasses(
  classes: { class: string; level: number }[],
): boolean {
  if (classes.some((c) => c.class === "Warlock" && c.level > 0)) return true;
  return multiclassCasterLevel(classes) > 0;
}

export function sheetSlotPoolsFromClasses(
  classes: { class: string; level: number }[],
): Record<string, { max: number; used: number }> {
  const slots = spellSlotsForClasses(classes);
  const out: Record<string, { max: number; used: number }> = {};
  for (const [level, pool] of Object.entries(slots)) {
    out[level] = { max: pool.max, used: 0 };
  }
  return out;
}
