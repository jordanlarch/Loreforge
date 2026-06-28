import {
  buildItemDefinition,
  validateItemDefinition,
  type ItemArmorStats,
  type ItemDefinition,
  type ItemEquippedEffect,
  type ItemPropertyDefinition,
  type ItemType,
  type ItemWeaponStats,
} from "@app/engine";

export type SmithyItemMechanicsInput = {
  weapon?: ItemWeaponStats;
  armor?: ItemArmorStats;
  equippedEffects?: ItemEquippedEffect[];
  propertyDetails?: ItemPropertyDefinition[];
};

export function assembleItemDefinition(input: {
  name: string;
  type: ItemType;
  description: string;
  mechanics?: SmithyItemMechanicsInput;
  existing?: ItemDefinition;
}): ItemDefinition {
  return buildItemDefinition({
    name: input.name,
    itemType: input.type,
    description: input.description,
    weapon: input.mechanics?.weapon,
    armor: input.mechanics?.armor,
    equippedEffects: input.mechanics?.equippedEffects,
    propertyDetails: input.mechanics?.propertyDetails,
    cost: input.existing?.cost,
    weight: input.existing?.weight,
    optionContent: input.existing?.optionContent,
    id: input.existing?.id,
  });
}

export function assertValidItemDefinition(def: ItemDefinition): void {
  const errors = validateItemDefinition(def);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}
