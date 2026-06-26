import { describe, expect, it } from "vitest";

import {
  applyLongRestMeta,
  ensureHitDice,
  refreshSpellSlots,
} from "./sheet-rest";

describe("sheet-rest", () => {
  it("long rest restores HP and clears death saves", () => {
    const next = applyLongRestMeta(
      {
        currentHp: 5,
        tempHp: 3,
        deathSaves: { successes: 1, failures: 2 },
        resourceUses: { rage: [true] },
      },
      40,
    );
    expect(next.currentHp).toBe(40);
    expect(next.tempHp).toBe(0);
    expect(next.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(next.resourceUses?.rage).toEqual([false]);
  });

  it("refreshSpellSlots clears used counters", () => {
    expect(
      refreshSpellSlots({
        spells: [],
        slots: { "1": { max: 4, used: 3 } },
      }),
    ).toEqual({
      spells: [],
      slots: { "1": { max: 4, used: 0 } },
    });
  });

  it("ensureHitDice seeds per-class pools", () => {
    expect(
      ensureHitDice({}, [{ class: "Fighter", level: 3 }]).hitDice,
    ).toEqual({ Fighter: { current: 3, max: 3 } });
  });
});
