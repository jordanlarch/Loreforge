/**
 * Derive character AC from equipped Smithy/Codex {@link ItemDefinition} armor blocks (DATA-1a).
 * Falls back to stored `baseAc` when no structured armor is equipped.
 */
import { abilityModifier } from "../entities/abilities";
import type { ItemDefinition } from "./item-definitions";

export type EquipmentArmorEntry = {
  name: string;
  equipped: boolean;
  quantity: number;
  smithyItemId?: string;
  codexSlug?: string;
};

export type DerivedArmorClass = {
  ac: number;
  /** Whether AC came from equipped item definitions vs stored character row. */
  source: "stored" | "derived";
};

function equippedItems(
  equipment: readonly EquipmentArmorEntry[],
): EquipmentArmorEntry[] {
  return equipment.filter((e) => e.equipped && (e.quantity ?? 0) > 0);
}

function acBonusFromEffects(def: ItemDefinition): number {
  return (def.equippedEffects ?? []).reduce((sum, effect) => {
    if (effect.modifier.type === "ac_bonus") return sum + effect.modifier.amount;
    return sum;
  }, 0);
}

function applyDexToArmor(baseAc: number, dexMod: number, dexBonusMax?: number | null): number {
  if (dexBonusMax === null) return baseAc + dexMod;
  if (dexBonusMax === undefined) return baseAc;
  return baseAc + Math.min(dexMod, dexBonusMax);
}

/**
 * Compute AC from equipped Smithy/Codex armor/shield definitions when present.
 * Uses the highest base AC body armor + one shield (+2) + equipped AC effects.
 */
export function deriveEquippedArmorClass(input: {
  dexScore: number;
  storedBaseAc: number;
  equipment: readonly EquipmentArmorEntry[];
  /** Smithy homebrew items keyed by `smithyItemId`. */
  itemDefinitions: Readonly<Record<string, ItemDefinition>>;
  /** Codex SRD items keyed by `codexSlug`. */
  codexDefinitions?: Readonly<Record<string, ItemDefinition>>;
}): DerivedArmorClass {
  const dexMod = abilityModifier(input.dexScore);
  const items = equippedItems(input.equipment);

  const bodyArmors: ItemDefinition[] = [];
  let shieldEquipped = false;
  let effectBonus = 0;

  for (const item of items) {
    let def: ItemDefinition | undefined;
    if (item.smithyItemId) {
      def = input.itemDefinitions[item.smithyItemId];
    } else if (item.codexSlug) {
      def = input.codexDefinitions?.[item.codexSlug];
    }
    if (!def?.armor) continue;
    effectBonus += acBonusFromEffects(def);
    if (def.armor.shield) {
      shieldEquipped = true;
      continue;
    }
    bodyArmors.push(def);
  }

  if (bodyArmors.length === 0 && !shieldEquipped && effectBonus === 0) {
    return { ac: input.storedBaseAc, source: "stored" };
  }

  let ac: number;
  if (bodyArmors.length > 0) {
    const best = bodyArmors.reduce((a, b) =>
      (a.armor!.baseAc >= b.armor!.baseAc ? a : b),
    );
    ac = applyDexToArmor(
      best.armor!.baseAc,
      dexMod,
      best.armor!.dexBonusMax,
    );
  } else {
    ac = 10 + dexMod;
  }

  if (shieldEquipped) ac += 2;

  return { ac: ac + effectBonus, source: "derived" };
}
