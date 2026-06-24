/**
 * Tutorial Scene 2 tavern menu — "The Hearth and Hemlock" (TUT-1 M6-3).
 *
 * Display-only catalog for Barnaby's common room. Nothing is purchasable in the
 * tutorial (no currency math); the overlay shows what a tavern menu looks like
 * before the player pivots to Lily and the hook.
 *
 * @see docs/onboarding/tutorial-adventure.md §Scene 2
 */
import type { ShopListing } from "@/lib/tutorial-shop";

/** The Hearth and Hemlock menu (Barnaby's board). */
export const TUTORIAL_TAVERN = {
  name: "The Hearth and Hemlock",
  keeper: "Barnaby Bramblefoot",
  keeperBlurb: "Halfling · Tavernkeeper",
  /** Mira's starting purse from the tutorial spec (display only). */
  purseGp: 15,
  listings: [
    {
      icon: "🍲",
      name: "Hearty stew",
      price: "2 sp",
      blurb: "Root vegetables, barley, and whatever the pot held yesterday.",
    },
    {
      icon: "🍷",
      name: "Mulled wine",
      price: "1 sp",
      blurb: "Cinnamon and cloves — the house special on cold nights.",
    },
    {
      icon: "🍺",
      name: "Dark ale",
      price: "4 cp",
      blurb: "Local brew; Barnaby keeps the good cask for regulars.",
    },
    {
      icon: "🛏",
      name: "Room for the night",
      price: "5 sp",
      blurb: "A narrow bed above the common room. Rain on the slate roof included.",
    },
  ] satisfies ShopListing[],
} as const;
