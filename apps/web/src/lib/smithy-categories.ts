export const SMITHY_LIBRARY_CATEGORIES = [
  "All",
  "Species",
  "Backgrounds",
  "Classes",
  "Animals",
  "Monsters",
  "Items",
  "Spells",
  "Feats",
  "Advanced",
] as const;

export type SmithyLibraryCategory = (typeof SMITHY_LIBRARY_CATEGORIES)[number];

const SNAPSHOT_CATEGORIES = new Set<string>([
  "Species",
  "Backgrounds",
  "Classes",
  "Animals",
  "Monsters",
  "Feats",
  "Advanced",
]);

/** Resolve a homebrew item row to a library category (null = All-only, e.g. Rules snapshots). */
export function smithyItemLibraryCategory(item: {
  copiedFromSlug: string | null;
}): Exclude<SmithyLibraryCategory, "All" | "Spells"> | null {
  const slug = item.copiedFromSlug;
  if (slug?.includes(":")) {
    const prefix = slug.split(":")[0]!;
    if (prefix === "Rules") return null;
    if (SNAPSHOT_CATEGORIES.has(prefix)) {
      return prefix as Exclude<SmithyLibraryCategory, "All" | "Spells" | "Items">;
    }
  }
  return "Items";
}

export function smithyCategoryLabel(category: SmithyLibraryCategory): string {
  if (category === "All") return "All My Homebrew";
  if (category === "Classes") return "Classes & Subclasses";
  if (category === "Monsters") return "Monsters & NPCs";
  if (category === "Advanced") return "Advanced Rules";
  return category;
}
