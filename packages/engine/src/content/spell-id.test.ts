import { describe, expect, it } from "vitest";

import { isSpellPrepared, spellNameToId } from "./spell-id";

describe("spellNameToId", () => {
  it("slugifies display names for registry lookup", () => {
    expect(spellNameToId("Fire Bolt")).toBe("fire-bolt");
    expect(spellNameToId("Melf's Acid Arrow")).toBe("melfs-acid-arrow");
    expect(spellNameToId("  Shield of Faith ")).toBe("shield-of-faith");
  });
});

describe("isSpellPrepared", () => {
  it("allows any spell when the gate list is omitted", () => {
    expect(isSpellPrepared(undefined, "fireball")).toBe(true);
  });

  it("requires membership when a prepared list is present", () => {
    const list = ["fire-bolt", "shield"];
    expect(isSpellPrepared(list, "fire-bolt")).toBe(true);
    expect(isSpellPrepared(list, "fireball")).toBe(false);
  });
});
