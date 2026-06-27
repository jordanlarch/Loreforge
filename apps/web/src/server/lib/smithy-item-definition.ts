import {
  buildItemDefinition,
  validateItemDefinition,
  type ItemArmorStats,
  type ItemDefinition,
  type ItemEquippedEffect,
  type ItemType,
  type ItemWeaponStats,
} from "@app/engine";

export type SmithyItemMechanicsInput = {
  weapon?: ItemWeaponStats;
  armor?: ItemArmorStats;
  equippedEffects?: ItemEquippedEffect[];
};

export function assembleItemDefinition(input: {
  name: string;
  type: ItemType;
  description: string;
  mechanics?: SmithyItemMechanicsInput;
}): ItemDefinition {
  return buildItemDefinition({
    name: input.name,
    itemType: input.type,
    description: input.description,
    weapon: input.mechanics?.weapon,
    armor: input.mechanics?.armor,
    equippedEffects: input.mechanics?.equippedEffects,
  });
}

export function assertValidItemDefinition(def: ItemDefinition): void {
  const errors = validateItemDefinition(def);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}
