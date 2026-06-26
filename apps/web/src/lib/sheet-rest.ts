/**
 * Sheet-side rest helpers — refresh resource uses and HP pools stored in notes meta.
 * Engine `short_rest` / `long_rest` commands apply during Live Play; this mirrors
 * the same outcomes for out-of-combat sheet tracking.
 */
import {
  featureRechargeMap,
  refreshResourceUsesOnRest,
  type ClassFeature,
} from "@app/engine";

import type { CharacterSheetMeta } from "./character-sheet-storage";
import type { SpellLoadout } from "./character";

/** Reset spent resource checkboxes for features with matching recharge. */
export function refreshResourceUses(
  meta: CharacterSheetMeta,
  classes: { class: string; level: number }[],
  rest: "short_rest" | "long_rest",
): CharacterSheetMeta {
  const recharge = featureRechargeMap(classes);
  return {
    ...meta,
    resourceUses: refreshResourceUsesOnRest(meta.resourceUses, recharge, rest),
  };
}

export function applyShortRestMeta(
  meta: CharacterSheetMeta,
  classes: { class: string; level: number }[],
): CharacterSheetMeta {
  return refreshResourceUses(meta, classes, "short_rest");
}

export function applyLongRestMeta(
  meta: CharacterSheetMeta,
  classes: { class: string; level: number }[],
  maxHp: number,
): CharacterSheetMeta {
  let next = refreshResourceUses(meta, classes, "long_rest");
  next = {
    ...next,
    currentHp: maxHp,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
  };
  if (next.hitDice) {
    const hitDice = { ...next.hitDice };
    for (const key of Object.keys(hitDice)) {
      hitDice[key] = { ...hitDice[key]!, current: hitDice[key]!.max };
    }
    next.hitDice = hitDice;
  }
  return next;
}

/** Reset all spell slot `used` counters to 0. */
export function refreshSpellSlots(loadout: SpellLoadout): SpellLoadout {
  const slots: SpellLoadout["slots"] = {};
  for (const [level, slot] of Object.entries(loadout.slots)) {
    slots[level] = { max: slot.max, used: 0 };
  }
  return { ...loadout, slots };
}

/** Ensure hit-dice tracker exists: one die per class level (5E). */
export function ensureHitDice(
  meta: CharacterSheetMeta,
  classes: { class: string; level: number }[],
): CharacterSheetMeta {
  const hitDice = { ...(meta.hitDice ?? {}) };
  for (const cl of classes) {
    if (!hitDice[cl.class]) {
      hitDice[cl.class] = { current: cl.level, max: cl.level };
    } else if (hitDice[cl.class]!.max < cl.level) {
      const gained = cl.level - hitDice[cl.class]!.max;
      hitDice[cl.class] = {
        max: cl.level,
        current: Math.min(cl.level, hitDice[cl.class]!.current + gained),
      };
    }
  }
  return { ...meta, hitDice };
}

// Re-export for tests / callers that need the type only.
export type { ClassFeature };
