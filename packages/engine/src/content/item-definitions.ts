/**
 * Declarative homebrew item definitions (SMITH-7) — weapons, armor, and passive
 * equipped modifiers. Imperative handlers / QuickJS sandbox deferred to P6.
 *
 * @see docs/engine/architecture.md §13
 */
import { parseDice } from "../rng/dice";

import {
  DAMAGE_TYPES,
  type DamageType,
} from "./spells";
import {
  ITEM_TYPES,
  type ItemType,
} from "./items";

export type ItemWeaponStats = {
  damage: { dice: string; type: DamageType };
  /** Flat magical enhancement (+1, +2, …) applied to attack and damage. */
  attackBonus?: number;
  finesse?: boolean;
  ranged?: boolean;
  /** Ranged range or melee reach override in feet. */
  rangeFt?: number;
};

export type ItemArmorStats = {
  baseAc: number;
  /** Max DEX bonus to AC; omit for fixed AC; null = unlimited DEX. */
  dexBonusMax?: number | null;
  stealthDisadvantage?: boolean;
  /** Shield (+2 AC while equipped). */
  shield?: boolean;
};

/** Passive modifier while the item is equipped (declarative subset of EffectTemplate). */
export type ItemEquippedEffect = {
  name: string;
  modifier:
    | { type: "ac_bonus"; amount: number }
    | { type: "attack_roll_bonus"; amount: number }
    | { type: "on_hit_damage"; dice: string; damageType: DamageType };
};

export type ItemDefinition = {
  id: string;
  name: string;
  itemType: ItemType;
  weapon?: ItemWeaponStats;
  armor?: ItemArmorStats;
  equippedEffects?: ItemEquippedEffect[];
  description: string;
};

/** Resolved weapon stats for sheet/combat loadout helpers. */
export type ResolvedWeaponSpec = {
  dice: string;
  damageType: string;
  attackBonus?: number;
  finesse?: boolean;
  ranged?: boolean;
  rangeFt?: number;
};

export function itemDefinitionId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function isValidDice(notation: unknown): boolean {
  if (typeof notation !== "string") return false;
  try {
    parseDice(notation);
    return true;
  } catch {
    return false;
  }
}

export function buildItemDefinition(input: {
  name: string;
  itemType: ItemType;
  description: string;
  weapon?: ItemWeaponStats;
  armor?: ItemArmorStats;
  equippedEffects?: ItemEquippedEffect[];
  id?: string;
}): ItemDefinition {
  return {
    id: input.id ?? itemDefinitionId(input.name),
    name: input.name.trim(),
    itemType: input.itemType,
    description: input.description.trim(),
    ...(input.weapon ? { weapon: input.weapon } : {}),
    ...(input.armor ? { armor: input.armor } : {}),
    ...(input.equippedEffects?.length
      ? { equippedEffects: input.equippedEffects }
      : {}),
  };
}

export function weaponSpecFromItemDefinition(
  def: ItemDefinition,
): ResolvedWeaponSpec | undefined {
  if (!def.weapon) return undefined;
  const w = def.weapon;
  return {
    dice: w.damage.dice,
    damageType: w.damage.type,
    attackBonus: w.attackBonus,
    finesse: w.finesse,
    ranged: w.ranged,
    rangeFt: w.rangeFt,
  };
}

/**
 * Structural + semantic validation of a declarative {@link ItemDefinition}.
 * Returns human-readable problems; empty array means valid.
 */
export function validateItemDefinition(def: ItemDefinition): string[] {
  const errors: string[] = [];

  if (!def.name?.trim()) errors.push("Name is required.");
  if (!(ITEM_TYPES as readonly string[]).includes(def.itemType)) {
    errors.push("Unknown item type.");
  }
  if (!def.id?.trim()) errors.push("Item id is required.");

  if (def.itemType === "Weapon" && !def.weapon) {
    errors.push("Weapon items need damage dice and type.");
  }
  if (def.itemType === "Armor" && !def.armor) {
    errors.push("Armor items need a base AC.");
  }

  if (def.weapon) {
    if (!isValidDice(def.weapon.damage.dice)) {
      errors.push(`Weapon damage has invalid dice "${def.weapon.damage.dice}".`);
    }
    if (!(DAMAGE_TYPES as readonly string[]).includes(def.weapon.damage.type)) {
      errors.push("Weapon damage type is unknown.");
    }
    if (
      def.weapon.attackBonus != null &&
      (def.weapon.attackBonus < -5 || def.weapon.attackBonus > 10)
    ) {
      errors.push("Weapon attack bonus must be between -5 and +10.");
    }
    if (
      def.weapon.rangeFt != null &&
      (def.weapon.rangeFt < 5 || def.weapon.rangeFt > 600)
    ) {
      errors.push("Weapon range must be between 5 and 600 ft.");
    }
  }

  if (def.armor) {
    if (def.armor.baseAc < 10 || def.armor.baseAc > 30) {
      errors.push("Armor base AC must be between 10 and 30.");
    }
    if (
      def.armor.dexBonusMax != null &&
      def.armor.dexBonusMax !== null &&
      (def.armor.dexBonusMax < 0 || def.armor.dexBonusMax > 5)
    ) {
      errors.push("Armor DEX bonus cap must be 0–5 or unlimited.");
    }
  }

  def.equippedEffects?.forEach((effect, i) => {
    if (!effect.name?.trim()) {
      errors.push(`Equipped effect ${i + 1} needs a name.`);
    }
    const mod = effect.modifier;
    if (mod.type === "ac_bonus") {
      if (mod.amount < -5 || mod.amount > 10) {
        errors.push(`Equipped effect ${i + 1} AC bonus out of range.`);
      }
    } else if (mod.type === "attack_roll_bonus") {
      if (mod.amount < -5 || mod.amount > 10) {
        errors.push(`Equipped effect ${i + 1} attack bonus out of range.`);
      }
    } else if (mod.type === "on_hit_damage") {
      if (!isValidDice(mod.dice)) {
        errors.push(`Equipped effect ${i + 1} has invalid on-hit dice.`);
      }
      if (!(DAMAGE_TYPES as readonly string[]).includes(mod.damageType)) {
        errors.push(`Equipped effect ${i + 1} has unknown on-hit damage type.`);
      }
    }
  });

  return errors;
}

export function isValidItemDefinition(def: ItemDefinition): boolean {
  return validateItemDefinition(def).length === 0;
}
