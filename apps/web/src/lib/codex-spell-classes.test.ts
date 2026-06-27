import { describe, expect, it } from "vitest";

import { spellClassesFromRaw, spellListsClass } from "./codex-spell-classes";

describe("spellClassesFromRaw", () => {
  it("reads Open5e classes array", () => {
    expect(
      spellClassesFromRaw({
        classes: [{ name: "Wizard", key: "srd_wizard" }, { name: "Sorcerer" }],
      }),
    ).toEqual(["Wizard", "Sorcerer"]);
  });

  it("returns empty for missing data", () => {
    expect(spellClassesFromRaw(null)).toEqual([]);
    expect(spellClassesFromRaw({})).toEqual([]);
  });
});

describe("spellListsClass", () => {
  it("matches case-insensitively", () => {
    expect(spellListsClass({ classes: [{ name: "Wizard" }] }, "wizard")).toBe(true);
    expect(spellListsClass({ classes: [{ name: "Wizard" }] }, "Cleric")).toBe(false);
  });
});
