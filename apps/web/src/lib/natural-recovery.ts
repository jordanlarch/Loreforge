import {
  classLevel,
  hasClassSubclass,
  NATURAL_RECOVERY_RESOURCE_KEY,
  naturalRecoveryMaximum,
  remainingFeatureUses,
} from "@app/engine";

import type { SpellLoadout } from "./character";

/** Expended spell slot levels a Circle of the Land druid may recover. */
export function expendedSlotLevels(loadout: SpellLoadout): number[] {
  const levels: number[] = [];
  for (const [levelStr, slot] of Object.entries(loadout.slots)) {
    const level = Number.parseInt(levelStr, 10);
    if (!Number.isFinite(level) || level < 1) continue;
    for (let i = 0; i < slot.used; i += 1) {
      levels.push(level);
    }
  }
  return levels.sort((a, b) => a - b);
}

export function naturalRecoveryAvailable(
  classes: { class: string; level: number; subclass?: string }[],
  resourceUses: Record<string, boolean[]> | undefined,
): boolean {
  if (!hasClassSubclass(classes, "Druid", "Circle of the Land")) return false;
  if (classLevel(classes, "Druid") < 2) return false;
  return remainingFeatureUses(resourceUses?.[NATURAL_RECOVERY_RESOURCE_KEY], 1) > 0;
}

export function naturalRecoveryBudget(
  classes: { class: string; level: number }[],
): number {
  return naturalRecoveryMaximum(classLevel(classes, "Druid"));
}

/** Apply Natural Recovery picks to a spell loadout (decrement used counters). */
export function applyNaturalRecoveryToLoadout(
  loadout: SpellLoadout,
  slotLevels: number[],
): SpellLoadout {
  const slots = { ...loadout.slots };
  for (const level of slotLevels) {
    const key = String(level);
    const slot = slots[key];
    if (!slot || slot.used < 1) {
      throw new Error(`No expended level-${level} slot to recover.`);
    }
    slots[key] = { ...slot, used: slot.used - 1 };
  }
  return { ...loadout, slots };
}
