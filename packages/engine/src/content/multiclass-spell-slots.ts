/**
 * Multiclass spell-slot pooling (PHB) — full + half casters combine into one
 * slot table via effective caster level. Warlock Pact Magic and third-caster
 * archetypes merge via {@link thirdCasterSlotMaxima}.
 */
import type { ClassLevel, SpellSlots } from "../entities/types";
import { fullCasterSlots } from "./spell-slots";
import {
  hasThirdCasterSlots,
  mergeSlotMaxima,
  thirdCasterSlotMaxima,
} from "./third-caster-slots";

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
/** True when the class list contributes pooled slots, pact magic, or third-caster slots. */
export function isSpellcastingClasses(
  classes: { class: string; level: number; subclass?: string }[],
): boolean {
  if (classes.some((c) => c.class === "Warlock" && c.level > 0)) return true;
  if (hasThirdCasterSlots(classes as ClassLevel[])) return true;
  return multiclassCasterLevel(classes) > 0;
}

function slotMaximaFromSpellSlots(slots: SpellSlots): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [level, pool] of Object.entries(slots)) {
    out[level] = pool.max;
  }
  return out;
}

export function sheetSlotPoolsFromClasses(
  classes: { class: string; level: number; subclass?: string }[],
): Record<string, { max: number; used: number }> {
  const pooled = slotMaximaFromSpellSlots(spellSlotsForClasses(classes));
  const third = thirdCasterSlotMaxima(classes as ClassLevel[]);
  const merged = mergeSlotMaxima(pooled, third);
  const out: Record<string, { max: number; used: number }> = {};
  for (const [level, max] of Object.entries(merged)) {
    if (max > 0) out[level] = { max, used: 0 };
  }
  return out;
}
