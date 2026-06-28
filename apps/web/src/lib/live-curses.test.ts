import { describe, expect, it } from "vitest";

import type { ItemDefinition } from "@app/engine";

import {
  activeCurseHudLabel,
  curseSlugForItem,
  cursesForUse,
} from "./live-curses";

describe("live-curses", () => {
  it("resolves demo vial names to registry slugs", () => {
    expect(
      curseSlugForItem({ name: "Sight Rot (vial)", quantity: 1, equipped: false }),
    ).toBe("srd-2024_sight-rot");
  });

  it("prefers Smithy toolboxCurseSlug metadata", () => {
    expect(
      curseSlugForItem(
        {
          name: "Tainted water",
          quantity: 1,
          equipped: false,
          smithyItemId: "item-1",
        },
        {
          "item-1": {
            id: "item-1",
            name: "Tainted water",
            description: "Cursed water sample.",
            itemType: "Potion",
            toolboxCurseSlug: "srd-2024_sight-rot",
          } satisfies ItemDefinition,
        },
      ),
    ).toBe("srd-2024_sight-rot");
  });

  it("lists curse items for Use Item rail", () => {
    const items = cursesForUse([
      { name: "Sight Rot (vial)", quantity: 1, equipped: false },
      { name: "Rations", quantity: 2, equipped: false },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("srd-2024_sight-rot");
  });

  it("formats active curse HUD labels", () => {
    expect(
      activeCurseHudLabel({
        instanceId: "curse:pc:1:sight:0",
        curseSlug: "srd-2024_sight-rot",
        pendingRecovery: false,
      }),
    ).toBe("Sight Rot");
    expect(
      activeCurseHudLabel({
        instanceId: "curse:pc:1:demo:0",
        curseSlug: "srd-2024_demonic-possession",
        pendingRecovery: true,
      }),
    ).toBe("Cursed — Demonic Possession");
  });
});
