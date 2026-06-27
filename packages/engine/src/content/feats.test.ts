import { describe, expect, it } from "vitest";

import {
  activeCombatAdjustments,
  aggregateFeatModifiers,
  effectiveMaxHpFromFeats,
} from "./feats";

describe("aggregateFeatModifiers", () => {
  it("stacks Alert and Mobile", () => {
    const m = aggregateFeatModifiers(["Alert", "Mobile"]);
    expect(m.initiativeBonus).toBe(5);
    expect(m.speedBonus).toBe(10);
  });

  it("Tough adds HP per level", () => {
    expect(effectiveMaxHpFromFeats(20, ["Tough"], 5)).toBe(30);
  });
});

describe("activeCombatAdjustments", () => {
  it("applies Sharpshooter when toggled", () => {
    const adj = activeCombatAdjustments(["Sharpshooter"], { sharpshooter: true }, {
      ranged: true,
      melee: false,
      heavyMelee: false,
    });
    expect(adj.attackBonus).toBe(-5);
    expect(adj.damageBonus).toBe(10);
  });
});
