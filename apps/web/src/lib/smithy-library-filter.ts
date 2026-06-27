/** Client/server helpers for Smithy library browse filters (SMITH-4). */

export type SmithyLibrarySortBy = "updatedAt" | "name";
export type SmithyLibrarySortDir = "asc" | "desc";
export type SmithyLibraryViewMode = "grid" | "list" | "table";

export type SmithyLibraryFilterInput = {
  search?: string;
  source?: "codex" | "original";
  sortBy?: SmithyLibrarySortBy;
  sortDir?: SmithyLibrarySortDir;
};

export type SmithyLibraryFilterable = {
  name: string;
  source: "codex" | "original";
  updatedAt: Date;
  descriptionSnippet?: string | null;
};

export function filterSortSmithyLibraryEntries<T extends SmithyLibraryFilterable>(
  entries: T[],
  input: SmithyLibraryFilterInput,
): T[] {
  let result = entries;
  const q = input.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        (entry.descriptionSnippet?.toLowerCase().includes(q) ?? false),
    );
  }
  if (input.source) {
    result = result.filter((entry) => entry.source === input.source);
  }

  const sortBy = input.sortBy ?? "updatedAt";
  const sortDir = input.sortDir ?? "desc";
  return [...result].sort((a, b) => {
    const cmp =
      sortBy === "name"
        ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : a.updatedAt.getTime() - b.updatedAt.getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });
}
