/**
 * 5E item content taxonomy — shared between the Smithy DB/zod schema and its UI
 * so the two never drift. These are content-model constants (like the SRD skill
 * list), not engine math; declarative {@link ItemDefinition} lives in
 * `item-definitions.ts` (SMITH-7). QuickJS sandbox handlers remain deferred.
 *
 * @see docs/ui-flows/smithy.md
 */

/** Item categories mirrored from the Codex/Smithy IA. */
export const ITEM_TYPES = [
  "Weapon",
  "Armor",
  "Adventuring Gear",
  "Tool",
  "Potion",
  "Magic Item",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** 5E magic-item rarity ladder (also used for mundane "Common" gear). */
export const ITEM_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary",
  "Artifact",
] as const;

export type ItemRarity = (typeof ITEM_RARITIES)[number];

/** Provenance of a homebrew item: forged from scratch or copied from the Codex. */
export const ITEM_SOURCES = ["original", "codex"] as const;

export type ItemSource = (typeof ITEM_SOURCES)[number];
