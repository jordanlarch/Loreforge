import { describe, expect, it } from "vitest";

import type { EquipmentItem } from "@/lib/character";
import {
  hasOilGrant,
  TUTORIAL_OIL_GRANT,
  TUTORIAL_SHOP,
  withOilGrant,
} from "@/lib/tutorial-shop";

describe("tutorial shop content", () => {
  it("lists Tinker's Mercy wares with the oil as the granted item", () => {
    expect(TUTORIAL_SHOP.name).toBe("Tinker's Mercy");
    expect(TUTORIAL_SHOP.listings).toHaveLength(3);
    const granted = TUTORIAL_SHOP.listings.filter((l) => l.granted);
    expect(granted).toHaveLength(1);
    expect(granted[0]?.name).toBe(TUTORIAL_OIL_GRANT.name);
  });

  it("describes the granted oil as a real, unequipped consumable", () => {
    expect(TUTORIAL_OIL_GRANT.name).toBe("Oil of Brightness");
    expect(TUTORIAL_OIL_GRANT.quantity).toBe(1);
    expect(TUTORIAL_OIL_GRANT.equipped).toBe(false);
    expect(TUTORIAL_OIL_GRANT.description).toMatch(/effect/i);
  });
});

describe("withOilGrant / hasOilGrant", () => {
  const base: EquipmentItem[] = [
    { name: "Longbow", quantity: 1, equipped: true },
  ];

  it("appends the oil exactly once and is idempotent", () => {
    expect(hasOilGrant(base)).toBe(false);

    const once = withOilGrant(base);
    expect(once).toHaveLength(2);
    expect(hasOilGrant(once)).toBe(true);

    const twice = withOilGrant(once);
    expect(twice).toHaveLength(2);
    expect(twice.filter((i) => i.name === TUTORIAL_OIL_GRANT.name)).toHaveLength(
      1,
    );
  });

  it("does not mutate the input array", () => {
    const input = [...base];
    withOilGrant(input);
    expect(input).toHaveLength(1);
  });
});
