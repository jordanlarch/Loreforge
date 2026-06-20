import { describe, expect, it } from "vitest";

import { ITEM_RARITIES, ITEM_SOURCES, ITEM_TYPES } from "./items";

describe("item taxonomy", () => {
  it("exposes the six item categories", () => {
    expect(ITEM_TYPES).toContain("Weapon");
    expect(ITEM_TYPES).toContain("Magic Item");
    expect(ITEM_TYPES).toHaveLength(6);
  });

  it("orders rarity from Common to Artifact", () => {
    expect(ITEM_RARITIES[0]).toBe("Common");
    expect(ITEM_RARITIES.at(-1)).toBe("Artifact");
    expect(new Set(ITEM_RARITIES).size).toBe(ITEM_RARITIES.length);
  });

  it("tracks original vs codex-copied provenance", () => {
    expect([...ITEM_SOURCES]).toEqual(["original", "codex"]);
  });
});
