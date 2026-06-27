/**
 * Third-caster archetypes (PHB) — Eldritch Knight / Arcane Trickster slot tables.
 */
import type { ClassLevel } from "../entities/types";

const THIRD_CASTER_SUBCLASSES = new Set([
  "Eldritch Knight",
  "Arcane Trickster",
]);

/** Slot maxima by class level (best row at or below current level). */
const THIRD_CASTER_TABLE: { minLevel: number; slots: Record<string, number> }[] =
  [
    { minLevel: 3, slots: { "1": 2 } },
    { minLevel: 7, slots: { "1": 2, "2": 2 } },
    { minLevel: 13, slots: { "1": 2, "2": 2, "3": 2 } },
    { minLevel: 19, slots: { "1": 2, "2": 2, "3": 2, "4": 1 } },
  ];

export function isThirdCasterSubclass(subclass: string | undefined): boolean {
  if (!subclass?.trim()) return false;
  return THIRD_CASTER_SUBCLASSES.has(subclass.trim());
}

/** Third-caster slot maxima for one archetype class entry. */
export function thirdCasterSlotsForClass(cl: ClassLevel): Record<string, number> {
  if (!isThirdCasterSubclass(cl.subclass)) return {};
  let best: Record<string, number> = {};
  for (const row of THIRD_CASTER_TABLE) {
    if (cl.level >= row.minLevel) best = row.slots;
  }
  return best;
}

/** Combined third-caster slots across all classes (max per level). */
export function thirdCasterSlotMaxima(
  classes: ClassLevel[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cl of classes) {
    const row = thirdCasterSlotsForClass(cl);
    for (const [level, max] of Object.entries(row)) {
      out[level] = Math.max(out[level] ?? 0, max);
    }
  }
  return out;
}

export function hasThirdCasterSlots(classes: ClassLevel[]): boolean {
  return Object.keys(thirdCasterSlotMaxima(classes)).length > 0;
}

/** Merge pooled multiclass slots with third-caster archetype slots (max per level). */
export function mergeSlotMaxima(
  pooled: Record<string, number>,
  third: Record<string, number>,
): Record<string, number> {
  const out = { ...pooled };
  for (const [level, max] of Object.entries(third)) {
    out[level] = Math.max(out[level] ?? 0, max);
  }
  return out;
}
