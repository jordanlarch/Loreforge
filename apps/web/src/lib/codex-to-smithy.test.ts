import { describe, expect, it } from "vitest";

import {
  codexCategorySnapshotType,
  codexSmithyCopyKey,
  open5eItemCategoryToType,
} from "./codex-to-smithy";

describe("codex-to-smithy", () => {
  it("builds idempotency keys", () => {
    expect(codexSmithyCopyKey("Items", "longsword")).toBe("longsword");
    expect(codexSmithyCopyKey("Species", "hill-dwarf")).toBe(
      "Species:hill-dwarf",
    );
  });

  it("maps Open5e item categories", () => {
    expect(open5eItemCategoryToType("weapon")).toBe("Weapon");
    expect(open5eItemCategoryToType("wondrous-item")).toBe("Magic Item");
    expect(open5eItemCategoryToType("gear")).toBe("Adventuring Gear");
  });

  it("picks snapshot item types", () => {
    expect(codexCategorySnapshotType("Monsters")).toBe("Magic Item");
    expect(codexCategorySnapshotType("Feats")).toBe("Adventuring Gear");
  });
});
