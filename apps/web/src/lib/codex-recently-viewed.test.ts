import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  readRecentlyViewed,
  recordCodexView,
  recordSmithyView,
  recentEntryHref,
} from "./codex-recently-viewed";

function mockBrowserStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
}

describe("codex-recently-viewed", () => {
  beforeEach(() => {
    mockBrowserStorage();
    localStorage.clear();
  });

  it("records codex views newest-first and dedupes", () => {
    recordCodexView({ category: "Spells", slug: "fireball", name: "Fireball" });
    recordCodexView({ category: "Species", slug: "dwarf", name: "Dwarf" });
    recordCodexView({ category: "Spells", slug: "fireball", name: "Fireball" });

    const items = readRecentlyViewed();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      source: "codex",
      slug: "fireball",
      name: "Fireball",
    });
  });

  it("records smithy views", () => {
    recordSmithyView({ kind: "spell", id: "abc", name: "Shadow Bolt" });
    expect(readRecentlyViewed()[0]).toMatchObject({
      source: "smithy",
      kind: "spell",
      id: "abc",
    });
  });

  it("builds hrefs for codex and smithy entries", () => {
    expect(
      recentEntryHref({
        source: "codex",
        category: "Spells",
        slug: "fireball",
        name: "Fireball",
        ts: 1,
      }),
    ).toBe("/codex/spells/fireball");

    expect(
      recentEntryHref({
        source: "smithy",
        kind: "item",
        id: "item-1",
        name: "Sword",
        ts: 1,
      }),
    ).toBe("/smithy/item-1");
  });
});
