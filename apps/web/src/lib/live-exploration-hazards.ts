import {
  BURNING_SLUG,
  type ActiveBurningInstance,
  type ItemDefinition,
} from "@app/engine";

import type { EquipmentItem } from "./character";

/** Demo item names → slugs / fall heights when Smithy metadata is absent. */
export const DEMO_EXPLORATION_ITEM_BURNING: Readonly<Record<string, string>> = {
  "alchemist's fire (flask)": BURNING_SLUG,
};

export const DEMO_EXPLORATION_ITEM_FALL_FT: Readonly<Record<string, number>> = {
  "pitfall sample (30 ft)": 30,
};

export type ExplorationHazardMenuItem = {
  name: string;
  quantity: number;
  burningSlug?: string;
  fallHeightFt?: number;
};

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function explorationHazardLabel(slug: string): string {
  return slug.replace(/^srd-2024_/, "").replace(/-/g, " ");
}

/** Comma-separated scene labels for top-bar / transition subtitle. */
export function formatSceneExplorationHazards(
  slugs?: readonly string[],
): string | undefined {
  if (!slugs?.length) return undefined;
  return slugs.map(explorationHazardLabel).join(", ");
}

export function burningSlugForItem(
  item: EquipmentItem,
  smithyItems?: Record<string, ItemDefinition>,
): string | undefined {
  const def =
    item.smithyItemId && smithyItems
      ? smithyItems[item.smithyItemId]
      : undefined;
  if (def?.explorationBurningSlug) return def.explorationBurningSlug;
  return DEMO_EXPLORATION_ITEM_BURNING[normalizeItemName(item.name)];
}

export function fallHeightForItem(
  item: EquipmentItem,
  smithyItems?: Record<string, ItemDefinition>,
): number | undefined {
  const def =
    item.smithyItemId && smithyItems
      ? smithyItems[item.smithyItemId]
      : undefined;
  if (
    def?.explorationFallHeightFt !== undefined &&
    Number.isFinite(def.explorationFallHeightFt) &&
    def.explorationFallHeightFt >= 0
  ) {
    return def.explorationFallHeightFt;
  }
  return DEMO_EXPLORATION_ITEM_FALL_FT[normalizeItemName(item.name)];
}

/** Burning + fall demo items available via Use Item. */
export function explorationHazardsForUse(
  equipment: readonly EquipmentItem[],
  smithyItems?: Record<string, ItemDefinition>,
): ExplorationHazardMenuItem[] {
  const items: ExplorationHazardMenuItem[] = [];
  const seen = new Set<string>();
  for (const row of equipment) {
    if ((row.quantity ?? 0) <= 0) continue;
    const key = normalizeItemName(row.name);
    if (seen.has(key)) continue;
    const burningSlug = burningSlugForItem(row, smithyItems);
    const fallHeightFt = fallHeightForItem(row, smithyItems);
    if (!burningSlug && fallHeightFt === undefined) continue;
    seen.add(key);
    items.push({
      name: row.name.trim(),
      quantity: row.quantity ?? 1,
      ...(burningSlug ? { burningSlug } : {}),
      ...(fallHeightFt !== undefined ? { fallHeightFt } : {}),
    });
    if (items.length >= 6) break;
  }
  return items;
}

/** HUD label for an ongoing burning instance on the party rail. */
export function activeBurningHudLabel(instance: ActiveBurningInstance): string {
  const name = explorationHazardLabel(instance.burningSlug);
  return instance.pendingRepeat ? `Burning — ${name}` : name;
}
