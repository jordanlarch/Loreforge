/**
 * SRD 5.2 Gameplay Toolbox → Poisons rules prose + sample poison seeds (DATA-1b).
 */
import type { PoisonDefinition } from "@app/engine";
import { toolboxEntryId } from "@app/engine";

export const POISONS_RULES_SECTION_SLUG = "srd-2024_poisons-rules";

export const POISONS_RULES_PROSE = `Given their insidious and deadly nature, poisons are a favorite tool among assassins and evil adventurers.

Poisons come in the following four types:

Contact. Contact poison can be smeared on an object and remains potent until it is touched or washed off. A creature that touches contact poison with exposed skin is subjected to its effects.

Ingested. A creature must swallow an entire dose of ingested poison to suffer its effects. The dose can be delivered in food or a liquid. You may decide that a partial dose has a reduced effect, such as allowing Advantage on the saving throw or dealing only half damage on a failed save.

Inhaled. These poisons are powders or gases that take effect when inhaled. Blowing the powder or releasing the gas subjects creatures in a 5-foot Cube to its effect. The resulting cloud dissipates immediately afterward. Holding one's breath is ineffective against inhaled poisons, as they affect nasal membranes, tear ducts, and other parts of the body.

Injury. Injury poison can be applied to weapons, ammunition, or similar objects and remains potent until delivered through a wound or washed off. A creature that takes Piercing or Slashing damage from an object coated with injury poison is subjected to its effects.

Purchasing Poison. At your discretion, poisons might be available for purchase in some locales. The prices in the sample poisons below are per dose.`;

type PoisonSeed = {
  slug: string;
  name: string;
  description: string;
  sortIndex: number;
  definition: PoisonDefinition;
};

function poison(
  seed: Omit<PoisonSeed, "definition"> & {
    definition: Omit<PoisonDefinition, "kind" | "id"> & { id?: string };
  },
): PoisonSeed {
  return {
    ...seed,
    definition: {
      ...seed.definition,
      id: seed.definition.id ?? toolboxEntryId(seed.name),
      kind: "poison",
    },
  };
}

/** PDF sample poisons — hand-normalized to GRILL-POISON Q3 `PoisonDefinition` shape. */
export const SRD_TOOLBOX_POISON_SEEDS: PoisonSeed[] = [
  poison({
    slug: "srd-2024_assassins-blood",
    name: "Assassin's Blood",
    description: "Ingested poison (150 gp).",
    sortIndex: 0,
    definition: {
      name: "Assassin's Blood",
      description: "Ingested poison (150 gp).",
      poisonType: "ingested",
      save: { ability: "con", dc: 10, onSuccess: "half" },
      damage: [{ dice: "1d12", type: "poison" }],
      conditions: ["poisoned"],
      repeat: "Poisoned for 24 hours on a failed save (half damage only on success).",
    },
  }),
  poison({
    slug: "srd-2024_burnt-othur-fumes",
    name: "Burnt Othur Fumes",
    description: "Inhaled poison (500 gp).",
    sortIndex: 1,
    definition: {
      name: "Burnt Othur Fumes",
      description: "Inhaled poison (500 gp).",
      poisonType: "inhaled",
      save: { ability: "con", dc: 13, onSuccess: "negates" },
      damage: [{ dice: "3d6", type: "poison" }],
      repeat:
        "Repeat save at start of each turn; 1d6 poison on each failed save. Ends after three successful saves.",
    },
  }),
  poison({
    slug: "srd-2024_crawler-mucus",
    name: "Crawler Mucus",
    description: "Contact poison (200 gp).",
    sortIndex: 2,
    definition: {
      name: "Crawler Mucus",
      description: "Contact poison (200 gp).",
      poisonType: "contact",
      save: { ability: "con", dc: 13, onSuccess: "negates" },
      conditions: ["poisoned"],
      repeat: "Poisoned for 1 minute on a failed save.",
    },
  }),
  poison({
    slug: "srd-2024_essence-of-ether",
    name: "Essence of Ether",
    description: "Inhaled poison (300 gp).",
    sortIndex: 3,
    definition: {
      name: "Essence of Ether",
      description: "Inhaled poison (300 gp).",
      poisonType: "inhaled",
      save: { ability: "con", dc: 15, onSuccess: "negates" },
      conditions: ["poisoned"],
      repeat:
        "Poisoned for 8 hours on a failed save; unconscious if the save fails by 5 or more.",
    },
  }),
  poison({
    slug: "srd-2024_malice",
    name: "Malice",
    description: "Inhaled poison (250 gp).",
    sortIndex: 4,
    definition: {
      name: "Malice",
      description: "Inhaled poison (250 gp).",
      poisonType: "inhaled",
      save: { ability: "con", dc: 15, onSuccess: "negates" },
      conditions: ["poisoned"],
      repeat:
        "Poisoned for 1 hour on a failed save; blinded if the save fails by 5 or more.",
    },
  }),
  poison({
    slug: "srd-2024_midnight-tears",
    name: "Midnight Tears",
    description: "Ingested poison (1,500 gp).",
    sortIndex: 5,
    definition: {
      name: "Midnight Tears",
      description: "Ingested poison (1,500 gp).",
      poisonType: "ingested",
      save: { ability: "con", dc: 17, onSuccess: "negates" },
      repeat:
        "No effect until midnight; then 9d6 poison damage if the initial save failed.",
    },
  }),
  poison({
    slug: "srd-2024_oil-of-taggit",
    name: "Oil of Taggit",
    description: "Contact poison (400 gp).",
    sortIndex: 6,
    definition: {
      name: "Oil of Taggit",
      description: "Contact poison (400 gp).",
      poisonType: "contact",
      save: { ability: "con", dc: 13, onSuccess: "negates" },
      conditions: ["poisoned"],
      repeat: "Poisoned for 24 hours on a failed save.",
    },
  }),
  poison({
    slug: "srd-2024_pale-tincture",
    name: "Pale Tincture",
    description: "Ingested poison (250 gp).",
    sortIndex: 7,
    definition: {
      name: "Pale Tincture",
      description: "Ingested poison (250 gp).",
      poisonType: "ingested",
      save: { ability: "con", dc: 16, onSuccess: "negates" },
      damage: [{ dice: "3d6", type: "poison" }],
      repeat:
        "Repeat save every 24 hours or max HP reduced by 1d6 until cured or dead.",
    },
  }),
  poison({
    slug: "srd-2024_purple-worm-poison",
    name: "Purple Worm Poison",
    description: "Injury poison (2,000 gp).",
    sortIndex: 8,
    definition: {
      name: "Purple Worm Poison",
      description: "Injury poison (2,000 gp).",
      poisonType: "injury",
      save: { ability: "con", dc: 19, onSuccess: "half" },
      damage: [{ dice: "12d6", type: "poison" }],
    },
  }),
  poison({
    slug: "srd-2024_serpent-venom",
    name: "Serpent Venom",
    description: "Injury poison (200 gp).",
    sortIndex: 9,
    definition: {
      name: "Serpent Venom",
      description: "Injury poison (200 gp).",
      poisonType: "injury",
      save: { ability: "con", dc: 11, onSuccess: "half" },
      damage: [{ dice: "3d6", type: "poison" }],
    },
  }),
  poison({
    slug: "srd-2024_spiders-sting",
    name: "Spider's Sting",
    description: "Injury poison (200 gp).",
    sortIndex: 10,
    definition: {
      name: "Spider's Sting",
      description: "Injury poison (200 gp).",
      poisonType: "injury",
      save: { ability: "con", dc: 13, onSuccess: "negates" },
      damage: [{ dice: "2d4", type: "poison" }],
      conditions: ["poisoned"],
      repeat: "Poisoned until the end of its next turn on a failed save.",
    },
  }),
  poison({
    slug: "srd-2024_torpor",
    name: "Torpor",
    description: "Ingested poison (600 gp).",
    sortIndex: 11,
    definition: {
      name: "Torpor",
      description: "Ingested poison (600 gp).",
      poisonType: "ingested",
      save: { ability: "con", dc: 15, onSuccess: "negates" },
      conditions: ["poisoned"],
      repeat: "Poisoned for 4d6 hours on a failed save.",
    },
  }),
  poison({
    slug: "srd-2024_truth-serum",
    name: "Truth Serum",
    description: "Ingested poison (150 gp).",
    sortIndex: 12,
    definition: {
      name: "Truth Serum",
      description: "Ingested poison (150 gp).",
      poisonType: "ingested",
      save: { ability: "con", dc: 11, onSuccess: "negates" },
      repeat: "Can't deliberately lie for 1 hour on a failed save.",
    },
  }),
  poison({
    slug: "srd-2024_wyvern-poison",
    name: "Wyvern Poison",
    description: "Injury poison (1,200 gp).",
    sortIndex: 13,
    definition: {
      name: "Wyvern Poison",
      description: "Injury poison (1,200 gp).",
      poisonType: "injury",
      save: { ability: "con", dc: 15, onSuccess: "half" },
      damage: [{ dice: "7d6", type: "poison" }],
    },
  }),
];
