import { describe, expect, it } from "vitest";

import { monsterTemplate } from "./monsters";

describe("monsterTemplate", () => {
  it("returns undefined for an unknown slug", () => {
    expect(monsterTemplate("not-a-monster")).toBeUndefined();
  });

  it("exposes the tutorial Hungering Shade boss (TUT-1 Scene 5, #174)", () => {
    const shade = monsterTemplate("hungering-shade");
    expect(shade).toBeDefined();
    expect(shade?.name).toBe("The Hungering Shade");
    // Tuned to last a few rounds without ever truly threatening a healed Mira.
    expect(shade?.maxHp).toBeGreaterThan(0);
    expect(shade?.baseAc).toBeGreaterThan(0);
    expect(shade?.abilityScores.dex).toBeGreaterThanOrEqual(14);
  });
});
