/**
 * SRD 5.2 weapon properties + 2024 weapon masteries for Smithy forge UI (SMITH-PROPS).
 * Canonical labels align with Open5e `srd-2024` item property keys.
 */
import type { ItemPropertyDefinition } from "./item-definitions";

export type CatalogPropertyEntry = {
  key: string;
  name: string;
  description: string;
  mastery?: boolean;
};

/** SRD 5.2 weapon properties (not masteries). */
export const SRD_WEAPON_PROPERTIES: readonly CatalogPropertyEntry[] = [
  {
    key: "ammunition",
    name: "Ammunition",
    description:
      "You can use a weapon that has the Ammunition property to make a ranged attack only if you have ammunition to fire from it. Each time you attack with the weapon, you expend one piece of ammunition.",
  },
  {
    key: "finesse",
    name: "Finesse",
    description:
      "When making an attack with a Finesse weapon, use your choice of Strength or Dexterity modifier for the attack and damage rolls.",
  },
  {
    key: "heavy",
    name: "Heavy",
    description:
      "Creatures that are Small or Tiny have Disadvantage on attack rolls with Heavy weapons.",
  },
  {
    key: "light",
    name: "Light",
    description:
      "When you take the Attack action on your turn and attack with a Light weapon, you can make one extra attack as a Bonus Action later on the same turn with a different Light weapon.",
  },
  {
    key: "loading",
    name: "Loading",
    description: "Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an Action, Bonus Action, or Reaction.",
  },
  {
    key: "range",
    name: "Range",
    description:
      "A Range weapon has a normal range and a long range in feet. Attacking at long range imposes Disadvantage.",
  },
  {
    key: "reach",
    name: "Reach",
    description:
      "This weapon adds 5 feet to your reach when you attack with it.",
  },
  {
    key: "thrown",
    name: "Thrown",
    description:
      "If a Thrown weapon has the Range property, you can throw the weapon to make a ranged attack with it.",
  },
  {
    key: "two-handed",
    name: "Two-Handed",
    description: "This weapon requires two hands when you attack with it.",
  },
  {
    key: "versatile",
    name: "Versatile",
    description:
      "This weapon can be used with one or two hands. Its damage die changes when used two-handed (see weapon stat block).",
  },
];

/** 2024 SRD weapon mastery properties (one per weapon). */
export const SRD_WEAPON_MASTERIES: readonly CatalogPropertyEntry[] = [
  {
    key: "cleave",
    name: "Cleave",
    mastery: true,
    description:
      "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach.",
  },
  {
    key: "graze",
    name: "Graze",
    mastery: true,
    description:
      "If your attack roll with this weapon misses a creature, you can deal damage equal to the ability modifier used for the attack roll.",
  },
  {
    key: "nick",
    name: "Nick",
    mastery: true,
    description:
      "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action.",
  },
  {
    key: "push",
    name: "Push",
    mastery: true,
    description:
      "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from you.",
  },
  {
    key: "sap",
    name: "Sap",
    mastery: true,
    description:
      "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  },
  {
    key: "slow",
    name: "Slow",
    mastery: true,
    description:
      "If you hit a creature with this weapon, you can reduce its Speed by 10 feet until the start of your next turn.",
  },
  {
    key: "topple",
    name: "Topple",
    mastery: true,
    description:
      "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw. On a failed save, it has the Prone condition.",
  },
  {
    key: "vex",
    name: "Vex",
    mastery: true,
    description:
      "If you hit a creature with this weapon, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  },
];

const ALL_ENTRIES = [...SRD_WEAPON_PROPERTIES, ...SRD_WEAPON_MASTERIES];

export function catalogEntryByKey(key: string): CatalogPropertyEntry | undefined {
  return ALL_ENTRIES.find((e) => e.key === key);
}

/** Build {@link ItemPropertyDefinition} rows from Smithy checkbox selection. */
export function buildPropertyDetailsFromSelection(input: {
  propertyKeys: readonly string[];
  masteryKey?: string | null;
}): ItemPropertyDefinition[] {
  const out: ItemPropertyDefinition[] = [];
  for (const key of input.propertyKeys) {
    const entry = catalogEntryByKey(key);
    if (!entry || entry.mastery) continue;
    out.push({
      key: entry.key,
      name: entry.name,
      description: entry.description,
    });
  }
  if (input.masteryKey) {
    const mastery = catalogEntryByKey(input.masteryKey);
    if (mastery?.mastery) {
      out.push({
        key: mastery.key,
        name: mastery.name,
        description: mastery.description,
        mastery: true,
      });
    }
  }
  return out;
}

/** Hydrate checkbox state from an existing definition (edit / Codex copy). */
export function selectionFromPropertyDetails(
  details: readonly ItemPropertyDefinition[] | undefined,
): { propertyKeys: string[]; masteryKey: string | null } {
  if (!details?.length) return { propertyKeys: [], masteryKey: null };
  const propertyKeys: string[] = [];
  let masteryKey: string | null = null;
  for (const row of details) {
    if (row.mastery) {
      masteryKey = row.key;
    } else {
      propertyKeys.push(row.key);
    }
  }
  return { propertyKeys, masteryKey };
}
