import { describe, expect, it } from "vitest";

import { filterSortSmithyLibraryEntries } from "./smithy-library-filter";

const base = new Date("2026-06-20T12:00:00Z");
const newer = new Date("2026-06-25T12:00:00Z");

const entries = [
  {
    name: "Zebra Cloak",
    source: "original" as const,
    updatedAt: base,
    descriptionSnippet: "Striped stealth gear.",
  },
  {
    name: "Fireball Copy",
    source: "codex" as const,
    updatedAt: newer,
    descriptionSnippet: "A copied evocation.",
  },
  {
    name: "Anvil Charm",
    source: "original" as const,
    updatedAt: newer,
    descriptionSnippet: null,
  },
];

describe("filterSortSmithyLibraryEntries", () => {
  it("filters by search on name and snippet", () => {
    expect(
      filterSortSmithyLibraryEntries(entries, { search: "fire" }),
    ).toHaveLength(1);
    expect(
      filterSortSmithyLibraryEntries(entries, { search: "stealth" }),
    ).toHaveLength(1);
  });

  it("filters by source", () => {
    expect(
      filterSortSmithyLibraryEntries(entries, { source: "codex" }),
    ).toHaveLength(1);
    expect(
      filterSortSmithyLibraryEntries(entries, { source: "original" }),
    ).toHaveLength(2);
  });

  it("sorts by updatedAt desc by default", () => {
    const sorted = filterSortSmithyLibraryEntries(entries, {});
    expect(sorted[0]?.name).toBe("Fireball Copy");
  });

  it("sorts by name ascending", () => {
    const sorted = filterSortSmithyLibraryEntries(entries, {
      sortBy: "name",
      sortDir: "asc",
    });
    expect(sorted.map((e) => e.name)).toEqual([
      "Anvil Charm",
      "Fireball Copy",
      "Zebra Cloak",
    ]);
  });
});
