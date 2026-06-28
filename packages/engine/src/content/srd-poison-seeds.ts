/**
 * SRD 5.2 Gameplay Toolbox poison definitions — engine runtime registry (DATA-1b / GRILL-LIVE-POISON).
 * DB Codex seeds import these; keep in sync with `packages/db/src/ingest/srd-toolbox-poisons.ts` prose rows.
 */
import { toolboxEntryId, type PoisonDefinition } from "./toolbox-definitions";

export type SrdPoisonSeed = {
  slug: string;
  sortIndex: number;
  definition: PoisonDefinition;
};

function poison(
  slug: string,
  sortIndex: number,
  definition: Omit<PoisonDefinition, "kind" | "id"> & { id?: string },
): SrdPoisonSeed {
  return {
    slug,
    sortIndex,
    definition: {
      ...definition,
      id: definition.id ?? toolboxEntryId(definition.name),
      kind: "poison",
    },
  };
}

/** PDF sample poisons — hand-normalized to GRILL-POISON Q3 `PoisonDefinition` shape. */
export const SRD_POISON_SEEDS: readonly SrdPoisonSeed[] = [
  poison("srd-2024_assassins-blood", 0, {
    name: "Assassin's Blood",
    description: "Ingested poison (150 gp).",
    poisonType: "ingested",
    save: { ability: "con", dc: 10, onSuccess: "half" },
    damage: [{ dice: "1d12", type: "poison" }],
    conditions: ["poisoned"],
    repeat: "Poisoned for 24 hours on a failed save (half damage only on success).",
  }),
  poison("srd-2024_burnt-othur-fumes", 1, {
    name: "Burnt Othur Fumes",
    description: "Inhaled poison (500 gp).",
    poisonType: "inhaled",
    save: { ability: "con", dc: 13, onSuccess: "negates" },
    damage: [{ dice: "3d6", type: "poison" }],
    repeat:
      "Repeat save at start of each turn; 1d6 poison on each failed save. Ends after three successful saves.",
  }),
  poison("srd-2024_crawler-mucus", 2, {
    name: "Crawler Mucus",
    description: "Contact poison (200 gp).",
    poisonType: "contact",
    save: { ability: "con", dc: 13, onSuccess: "negates" },
    conditions: ["poisoned"],
    repeat: "Poisoned for 1 minute on a failed save.",
  }),
  poison("srd-2024_essence-of-ether", 3, {
    name: "Essence of Ether",
    description: "Inhaled poison (300 gp).",
    poisonType: "inhaled",
    save: { ability: "con", dc: 15, onSuccess: "negates" },
    conditions: ["poisoned"],
    repeat:
      "Poisoned for 8 hours on a failed save; unconscious if the save fails by 5 or more.",
  }),
  poison("srd-2024_malice", 4, {
    name: "Malice",
    description: "Inhaled poison (250 gp).",
    poisonType: "inhaled",
    save: { ability: "con", dc: 15, onSuccess: "negates" },
    conditions: ["poisoned"],
    repeat:
      "Poisoned for 1 hour on a failed save; blinded if the save fails by 5 or more.",
  }),
  poison("srd-2024_midnight-tears", 5, {
    name: "Midnight Tears",
    description: "Ingested poison (1,500 gp).",
    poisonType: "ingested",
    save: { ability: "con", dc: 17, onSuccess: "negates" },
    repeat:
      "No effect until midnight; then 9d6 poison damage if the initial save failed.",
  }),
  poison("srd-2024_oil-of-taggit", 6, {
    name: "Oil of Taggit",
    description: "Contact poison (400 gp).",
    poisonType: "contact",
    save: { ability: "con", dc: 13, onSuccess: "negates" },
    conditions: ["poisoned"],
    repeat: "Poisoned for 24 hours on a failed save.",
  }),
  poison("srd-2024_pale-tincture", 7, {
    name: "Pale Tincture",
    description: "Ingested poison (250 gp).",
    poisonType: "ingested",
    save: { ability: "con", dc: 16, onSuccess: "negates" },
    damage: [{ dice: "3d6", type: "poison" }],
    repeat:
      "Repeat save every 24 hours or max HP reduced by 1d6 until cured or dead.",
  }),
  poison("srd-2024_purple-worm-poison", 8, {
    name: "Purple Worm Poison",
    description: "Injury poison (2,000 gp).",
    poisonType: "injury",
    save: { ability: "con", dc: 19, onSuccess: "half" },
    damage: [{ dice: "12d6", type: "poison" }],
  }),
  poison("srd-2024_serpent-venom", 9, {
    name: "Serpent Venom",
    description: "Injury poison (200 gp).",
    poisonType: "injury",
    save: { ability: "con", dc: 11, onSuccess: "half" },
    damage: [{ dice: "3d6", type: "poison" }],
  }),
  poison("srd-2024_spiders-sting", 10, {
    name: "Spider's Sting",
    description: "Injury poison (200 gp).",
    poisonType: "injury",
    save: { ability: "con", dc: 13, onSuccess: "negates" },
    damage: [{ dice: "2d4", type: "poison" }],
    conditions: ["poisoned"],
    repeat: "Poisoned until the end of its next turn on a failed save.",
  }),
  poison("srd-2024_torpor", 11, {
    name: "Torpor",
    description: "Ingested poison (600 gp).",
    poisonType: "ingested",
    save: { ability: "con", dc: 15, onSuccess: "negates" },
    conditions: ["poisoned"],
    repeat: "Poisoned for 4d6 hours on a failed save.",
  }),
  poison("srd-2024_truth-serum", 12, {
    name: "Truth Serum",
    description: "Ingested poison (150 gp).",
    poisonType: "ingested",
    save: { ability: "con", dc: 11, onSuccess: "negates" },
    repeat: "Can't deliberately lie for 1 hour on a failed save.",
  }),
  poison("srd-2024_wyvern-poison", 13, {
    name: "Wyvern Poison",
    description: "Injury poison (1,200 gp).",
    poisonType: "injury",
    save: { ability: "con", dc: 15, onSuccess: "half" },
    damage: [{ dice: "7d6", type: "poison" }],
  }),
];

export const POISON_REGISTRY: Readonly<Record<string, PoisonDefinition>> = Object.fromEntries(
  SRD_POISON_SEEDS.map((s) => [s.slug, s.definition]),
);

export function getPoisonDefinition(slug: string): PoisonDefinition | undefined {
  return POISON_REGISTRY[slug];
}
