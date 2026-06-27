import type { ItemRarity } from "@app/engine";

/** Tailwind badge classes for magic-item rarity (SMITH-8). */
export function smithyRarityBadgeClass(rarity: string): string {
  switch (rarity as ItemRarity) {
    case "Uncommon":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "Rare":
      return "bg-sky-500/15 text-sky-300 border-sky-500/40";
    case "Very Rare":
      return "bg-violet-500/15 text-violet-300 border-violet-500/40";
    case "Legendary":
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "Artifact":
      return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40";
    default:
      return "bg-lore-bg text-lore-muted border-lore-border";
  }
}
