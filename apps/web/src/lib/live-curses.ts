import {
  getCurseDefinition,
  type ActiveCurseInstance,
  type ItemDefinition,
} from "@app/engine";

import type { EquipmentItem } from "./character";

/** Demo curse items → registry slugs when Smithy metadata is absent (GRILL-LIVE-CURSE Q8). */
export const DEMO_CURSE_ITEM_SLUGS: Readonly<Record<string, string>> = {
  "sight rot (vial)": "srd-2024_sight-rot",
  "demonic possession (scroll)": "srd-2024_demonic-possession",
};

export type CurseMenuItem = {
  slug: string;
  label: string;
  quantity: number;
};

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve a curse slug from equipment + optional Smithy definition. */
export function curseSlugForItem(
  item: EquipmentItem,
  smithyItems?: Record<string, ItemDefinition>,
): string | undefined {
  const def =
    item.smithyItemId && smithyItems
      ? smithyItems[item.smithyItemId]
      : undefined;
  if (def?.toolboxCurseSlug) return def.toolboxCurseSlug;
  return DEMO_CURSE_ITEM_SLUGS[normalizeItemName(item.name)];
}

export function curseLabel(slug: string): string {
  return getCurseDefinition(slug)?.name ?? slug;
}

/** Curse-tagged items available via Use Item (self-target apply_curse). */
export function cursesForUse(
  equipment: readonly EquipmentItem[],
  smithyItems?: Record<string, ItemDefinition>,
): CurseMenuItem[] {
  const items: CurseMenuItem[] = [];
  const seen = new Set<string>();
  for (const row of equipment) {
    if ((row.quantity ?? 0) <= 0) continue;
    const slug = curseSlugForItem(row, smithyItems);
    if (!slug) continue;
    const def = getCurseDefinition(slug);
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

/** HUD label for an active curse instance on the party rail. */
export function activeCurseHudLabel(instance: ActiveCurseInstance): string {
  const name = curseLabel(instance.curseSlug);
  return instance.pendingRecovery ? `Cursed — ${name}` : name;
}
