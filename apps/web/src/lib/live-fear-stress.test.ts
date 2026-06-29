import { describe, expect, it } from "vitest";

import type { ItemDefinition } from "@app/engine";

import {
  activeFearStressHudLabel,
  DEMO_FEAR_STRESS_ITEM_SLUGS,
  fearStressForUse,
  fearStressLabel,
  fearStressSlugForItem,
  formatSceneFearStress,
} from "./live-fear-stress";

describe("live-fear-stress", () => {
  it("resolves demo vial slug by name", () => {
    expect(
      fearStressSlugForItem({
        name: "Hallucinogenic Substance (vial)",
        quantity: 1,
        equipped: false,
      }),
    ).toBe(DEMO_FEAR_STRESS_ITEM_SLUGS["hallucinogenic substance (vial)"]);
  });

  it("prefers Smithy toolboxFearStressSlug metadata", () => {
    const smithyItems: Record<string, ItemDefinition> = {
      "item-1": {
        id: "item-1",
        name: "Strange Tincture",
        itemType: "gear",
        description: "Test",
        toolboxFearStressSlug: "srd-2024_hallucinogenic-substance",
      },
    };
    expect(
      fearStressSlugForItem(
        { name: "Strange Tincture", quantity: 1, equipped: false, smithyItemId: "item-1" },
        smithyItems,
      ),
    ).toBe("srd-2024_hallucinogenic-substance");
  });

  it("formats scene fear labels", () => {
    expect(
      formatSceneFearStress(["srd-2024_sarcophagus-apparition"]),
    ).toBe("Sarcophagus Apparition");
  });

  it("lists fear/stress items for Use Item", () => {
    const items = fearStressForUse([
      { name: "Hallucinogenic Substance (vial)", quantity: 1, equipped: false },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("srd-2024_hallucinogenic-substance");
  });

  it("labels active fear HUD chip", () => {
    expect(
      activeFearStressHudLabel({
        instanceId: "fear:1",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
        pendingRepeat: true,
      }),
    ).toBe("Afraid — Sarcophagus Apparition");
    expect(fearStressLabel("srd-2024_sarcophagus-apparition")).toBe(
      "Sarcophagus Apparition",
    );
  });
});
