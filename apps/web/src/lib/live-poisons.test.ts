import { describe, expect, it } from "vitest";

import {
  activePoisonHudLabel,
  DEMO_POISON_VIAL_SLUGS,
  ingestedPoisonsForUse,
  injuryPoisonsForCoat,
  poisonSlugForItem,
} from "./live-poisons";

describe("live-poisons", () => {
  it("resolves demo vial slugs by name", () => {
    expect(
      poisonSlugForItem({ name: "Assassin's Blood (vial)", quantity: 1, equipped: false }),
    ).toBe(DEMO_POISON_VIAL_SLUGS["assassin's blood (vial)"]);
  });

  it("prefers Smithy toolboxPoisonSlug when present", () => {
    expect(
      poisonSlugForItem(
        { name: "Custom vial", quantity: 1, equipped: false, smithyItemId: "item-1" },
        {
          "item-1": {
            id: "item-1",
            name: "Custom vial",
            itemType: "Potion",
            description: "",
            toolboxPoisonSlug: "srd-2024_pale-tincture",
          },
        },
      ),
    ).toBe("srd-2024_pale-tincture");
  });

  it("splits injury vs ingested menu items", () => {
    const equipment = [
      { name: "Serpent Venom (vial)", quantity: 1, equipped: false },
      { name: "Pale Tincture (vial)", quantity: 1, equipped: false },
    ];
    expect(injuryPoisonsForCoat(equipment)).toHaveLength(1);
    expect(ingestedPoisonsForUse(equipment)).toHaveLength(1);
  });

  it("formats active poison HUD labels", () => {
    expect(
      activePoisonHudLabel({
        instanceId: "p:1",
        poisonSlug: "srd-2024_assassins-blood",
        pendingRepeat: false,
      }),
    ).toBe("Assassin's Blood");
    expect(
      activePoisonHudLabel({
        instanceId: "p:2",
        poisonSlug: "srd-2024_pale-tincture",
        pendingRepeat: true,
      }),
    ).toBe("Poisoned — Pale Tincture");
  });
});
