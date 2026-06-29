import {
  getFearStressDefinition,
  type ActiveFearStressInstance,
  type ItemDefinition,
} from "@app/engine";

import type { EquipmentItem } from "./character";

/** Demo vial names → registry slugs when Smithy metadata is absent (GRILL-LIVE-FEAR Q8). */
export const DEMO_FEAR_STRESS_ITEM_SLUGS: Readonly<Record<string, string>> = {
  "hallucinogenic substance (vial)": "srd-2024_hallucinogenic-substance",
};

export type FearStressMenuItem = {
  slug: string;
  label: string;
  quantity: number;
};

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve a fear/stress slug from equipment + optional Smithy definition. */
export function fearStressSlugForItem(
  item: EquipmentItem,
  smithyItems?: Record<string, ItemDefinition>,
): string | undefined {
  const def =
    item.smithyItemId && smithyItems
      ? smithyItems[item.smithyItemId]
      : undefined;
  if (def?.toolboxFearStressSlug) return def.toolboxFearStressSlug;
  return DEMO_FEAR_STRESS_ITEM_SLUGS[normalizeItemName(item.name)];
}

export function fearStressLabel(slug: string): string {
  return getFearStressDefinition(slug)?.name ?? slug;
}

/** Comma-separated scene labels for top-bar / transition subtitle (Q5). */
export function formatSceneFearStress(
  slugs?: readonly string[],
): string | undefined {
  if (!slugs?.length) return undefined;
  return slugs.map(fearStressLabel).join(", ");
}

/** One-shot mental stress + fear items available via Use Item. */
export function fearStressForUse(
  equipment: readonly EquipmentItem[],
  smithyItems?: Record<string, ItemDefinition>,
): FearStressMenuItem[] {
  const items: FearStressMenuItem[] = [];
  const seen = new Set<string>();
  for (const row of equipment) {
    if ((row.quantity ?? 0) <= 0) continue;
    const slug = fearStressSlugForItem(row, smithyItems);
    if (!slug) continue;
    const def = getFearStressDefinition(slug);
    if (!def) continue;
    const key = normalizeItemName(row.name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      slug,
      label: row.name.trim(),
      quantity: row.quantity ?? 1,
    });
    if (items.length >= 6) break;
  }
  return items;
}

/** HUD label for an ongoing fear instance on the party rail. */
export function activeFearStressHudLabel(
  instance: ActiveFearStressInstance,
): string {
  const name = fearStressLabel(instance.fearStressSlug);
  return instance.pendingRepeat ? `Afraid — ${name}` : name;
}
