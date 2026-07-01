import { describe, expect, it } from "vitest";

import { migrateDungeonToolboxLists } from "./dungeon-toolbox-fields";

describe("migrateDungeonToolboxLists", () => {
  it("converts legacy string lists to label/codexSlug rows", () => {
    const migrated = migrateDungeonToolboxLists({
      traps: ["Falling Net", "Poison Needle"],
      poisons: [{ label: "Serpent Venom", codexSlug: "srd-2024_serpent-venom" }],
    });
    expect(migrated.traps).toEqual([
      { label: "Falling Net", codexSlug: "" },
      { label: "Poison Needle", codexSlug: "" },
    ]);
    expect(migrated.poisons).toEqual([
      { label: "Serpent Venom", codexSlug: "srd-2024_serpent-venom" },
    ]);
  });
});
