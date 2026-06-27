/**
 * Derived combat/sheet modifiers from fighting styles and recorded feats (CHAR-8).
 * Deterministic — engine owns the math; sheet displays the result.
 */
import type { ClassLevel } from "./types";
import { fightingStylePickLevel } from "./class-choices";

export type FightingStyleModifiers = {
  acBonus: number;
  /** Bonus to ranged weapon attack rolls only. */
  rangedAttackBonus: number;
  /** Bonus to one-handed melee damage (Dueling). */
  meleeDamageBonus: number;
};

export type FeatModifiers = {
  initiativeBonus: number;
};

/** PHB fighting style bonuses applied when style is stored on the character. */
export function fightingStyleModifiers(
  className: string,
  style: string | undefined,
  opts: { wearingArmor: boolean; oneHandedMelee: boolean; ranged: boolean },
): FightingStyleModifiers {
  const out: FightingStyleModifiers = {
    acBonus: 0,
    rangedAttackBonus: 0,
    meleeDamageBonus: 0,
  };
  if (!style?.trim()) return out;
  switch (style) {
    case "Defense":
      if (opts.wearingArmor) out.acBonus = 1;
      break;
    case "Archery":
      if (opts.ranged) out.rangedAttackBonus = 2;
      break;
    case "Dueling":
      if (opts.oneHandedMelee) out.meleeDamageBonus = 2;
      break;
    default:
      break;
  }
  return out;
}

/** Aggregate style mods for a class entry (style keyed by class display name). */
export function styleModsForClass(
  cl: ClassLevel,
  fightingStyles: Record<string, string> | undefined,
  weaponContext: { wearingArmor: boolean; oneHandedMelee: boolean; ranged: boolean },
): FightingStyleModifiers {
  const pick = fightingStylePickLevel(cl.class);
  if (pick == null || cl.level < pick) {
    return { acBonus: 0, rangedAttackBonus: 0, meleeDamageBonus: 0 };
  }
  return fightingStyleModifiers(
    cl.class,
    fightingStyles?.[cl.class],
    weaponContext,
  );
}

/** Tracer feat modifiers from recorded feat names (expand as Codex ingest grows). */
export function featModifiers(feats: string[] | undefined): FeatModifiers {
  let initiativeBonus = 0;
  for (const name of feats ?? []) {
    const norm = name.trim().toLowerCase();
    if (norm === "alert" || norm.includes("alert")) initiativeBonus += 5;
  }
  return { initiativeBonus };
}

export function effectiveArmorClass(baseAc: number, acBonus: number): number {
  return baseAc + acBonus;
}

/** Best fighting-style bonus per modifier type across all classes. */
export function aggregateFightingStyleModifiers(
  classes: ClassLevel[],
  fightingStyles: Record<string, string> | undefined,
  weaponContext: {
    wearingArmor: boolean;
    oneHandedMelee: boolean;
    ranged: boolean;
  },
): FightingStyleModifiers {
  let acBonus = 0;
  let rangedAttackBonus = 0;
  let meleeDamageBonus = 0;
  for (const cl of classes) {
    const m = styleModsForClass(cl, fightingStyles, weaponContext);
    acBonus = Math.max(acBonus, m.acBonus);
    rangedAttackBonus = Math.max(rangedAttackBonus, m.rangedAttackBonus);
    meleeDamageBonus = Math.max(meleeDamageBonus, m.meleeDamageBonus);
  }
  return { acBonus, rangedAttackBonus, meleeDamageBonus };
}
