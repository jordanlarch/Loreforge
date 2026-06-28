import {
  getPoisonDefinition,
  type ActivePoisonInstance,
  type ItemDefinition,
} from "@app/engine";

import type { EquipmentItem } from "./character";

/** Demo vial names → registry slugs when Smithy metadata is absent (GRILL-LIVE-POISON Q8). */
export const DEMO_POISON_VIAL_SLUGS: Readonly<Record<string, string>> = {
  "serpent venom (vial)": "srd-2024_serpent-venom",
  "assassin's blood (vial)": "srd-2024_assassins-blood",
  "pale tincture (vial)": "srd-2024_pale-tincture",
};

export type PoisonMenuItem = {
  slug: string;
  label: string;
  quantity: number;
};

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve a poison slug from equipment + optional Smithy definition. */
export function poisonSlugForItem(
  item: EquipmentItem,
  smithyItems?: Record<string, ItemDefinition>,
): string | undefined {
  const def =
    item.smithyItemId && smithyItems
      ? smithyItems[item.smithyItemId]
      : undefined;
  if (def?.toolboxPoisonSlug) return def.toolboxPoisonSlug;
  return DEMO_POISON_VIAL_SLUGS[normalizeItemName(item.name)];
}

export function poisonLabel(slug: string): string {
  return getPoisonDefinition(slug)?.name ?? slug;
}

/** Injury poisons the PC can coat onto a weapon (combat Coat chip). */
export function injuryPoisonsForCoat(
  equipment: readonly EquipmentItem[],
  smithyItems?: Record<string, ItemDefinition>,
): PoisonMenuItem[] {
  const items: PoisonMenuItem[] = [];
  const seen = new Set<string>();
  for (const row of equipment) {
    if ((row.quantity ?? 0) <= 0) continue;
    const slug = poisonSlugForItem(row, smithyItems);
    if (!slug) continue;
    const def = getPoisonDefinition(slug);
    if (def?.poisonType !== "injury") continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    items.push({
      slug,
      label: def.name,
      quantity: row.quantity ?? 1,
    });
    if (items.length >= 6) break;
  }
  return items;
}

/** Ingested poisons available via Use Item (quick rail). */
export function ingestedPoisonsForUse(
  equipment: readonly EquipmentItem[],
  smithyItems?: Record<string, ItemDefinition>,
): PoisonMenuItem[] {
  const items: PoisonMenuItem[] = [];
  const seen = new Set<string>();
  for (const row of equipment) {
    if ((row.quantity ?? 0) <= 0) continue;
    const slug = poisonSlugForItem(row, smithyItems);
    if (!slug) continue;
    const def = getPoisonDefinition(slug);
    if (def?.poisonType !== "ingested") continue;
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

/** HUD label for an active poison instance on the party rail. */
export function activePoisonHudLabel(instance: ActivePoisonInstance): string {
  const name = poisonLabel(instance.poisonSlug);
  return instance.pendingRepeat ? `Poisoned — ${name}` : name;
}
