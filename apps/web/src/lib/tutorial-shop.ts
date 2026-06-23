/**
 * Tutorial Scene 3 shop content — "Tinker's Mercy" (TUT-1 M6-4, #172).
 *
 * Pure, browser-agnostic data so the shop card + the scripted item grant share
 * one source of truth and stay unit-testable. Per locked design D4 this is a
 * scripted grant, not a general item-economy system: Toric *gives* Mira the Oil
 * of Brightness on credit (no currency math), while the other listings exist
 * only to show what a shop looks like. The granted item is a real
 * `EquipmentItem` so it round-trips into the character's `equipment` and shows
 * in the inventory drawer.
 *
 * @see docs/onboarding/tutorial-adventure.md §Scene 3
 */
import type { EquipmentItem } from "@/lib/character";

/** A single line in the shop window (display only, except the granted item). */
export type ShopListing = {
  icon: string;
  name: string;
  /** Display price, e.g. "25 gp". Cosmetic — nothing is purchasable in v1. */
  price: string;
  blurb: string;
  /** True for the one item Toric gives Mira (Oil of Brightness). */
  granted?: boolean;
};

/** The item Toric gives Mira on credit — persisted into her `equipment`. */
export const TUTORIAL_OIL_GRANT: EquipmentItem = {
  name: "Oil of Brightness",
  quantity: 1,
  equipped: false,
  rarity: "common",
  description:
    "Lamp oil that burns ten times as bright. Has a real game effect — use it on the lantern later.",
};

/** The shopkeeper + their window of wares (the spec's Tinker's Mercy list). */
export const TUTORIAL_SHOP = {
  name: "Tinker's Mercy",
  keeper: "Toric Pennywhistle",
  keeperBlurb: "Gnome · Tinkerer",
  listings: [
    {
      icon: "🧪",
      name: TUTORIAL_OIL_GRANT.name,
      price: "25 gp",
      blurb: "Lamp oil that burns ten times as bright.",
      granted: true,
    },
    {
      icon: "🗡",
      name: "Silvered Arrow ×5",
      price: "15 gp",
      blurb: "Effective against creatures of the shadow.",
    },
    {
      icon: "🔥",
      name: "Tinder-Twigs (10)",
      price: "1 gp",
      blurb: "Catch any flame instantly.",
    },
  ] satisfies ShopListing[],
} as const;

/** Whether an inventory list already contains the granted oil (idempotency). */
export function hasOilGrant(equipment: readonly EquipmentItem[]): boolean {
  return equipment.some((i) => i.name === TUTORIAL_OIL_GRANT.name);
}

/** Append the granted oil to an inventory exactly once (pure helper). */
export function withOilGrant(
  equipment: readonly EquipmentItem[],
): EquipmentItem[] {
  if (hasOilGrant(equipment)) return [...equipment];
  return [...equipment, TUTORIAL_OIL_GRANT];
}
