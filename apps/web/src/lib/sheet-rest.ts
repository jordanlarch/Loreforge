/**
 * Sheet-side rest helpers — refresh resource uses and HP pools stored in notes meta.
 * Engine `short_rest` / `long_rest` commands apply during Live Play; this mirrors
 * the same outcomes for out-of-combat sheet tracking.
 */
import type { ClassFeature } from "@app/engine";

import type { CharacterSheetMeta } from "./character-sheet-storage";
import type { SpellLoadout } from "./character";

/** Reset spent resource checkboxes for features with matching recharge. */
export function refreshResourceUses(
  meta: CharacterSheetMeta,
  recharge: ClassFeature["recharge"] | "all",
): CharacterSheetMeta {
  const uses = meta.resourceUses ?? {};
  if (recharge === "all" || Object.keys(uses).length === 0) {
    const cleared: Record<string, boolean[]> = {};
    for (const [key, slots] of Object.entries(uses)) {
      cleared[key] = slots.map(() => false);
    }
    return { ...meta, resourceUses: cleared };
  }
  return meta;
}

export function applyShortRestMeta(meta: CharacterSheetMeta): CharacterSheetMeta {
  return refreshResourceUses(meta, "short_rest");
}

export function applyLongRestMeta(
  meta: CharacterSheetMeta,
  maxHp: number,
): CharacterSheetMeta {
  let next = refreshResourceUses(meta, "all");
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
