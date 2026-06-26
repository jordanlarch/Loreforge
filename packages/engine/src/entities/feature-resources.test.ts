import { describe, expect, it } from "vitest";

import {
  featureRechargeMap,
  featureResourceKey,
  refreshResourceUsesOnRest,
  remainingFeatureUses,
  spendFeatureUse,
} from "./feature-resources";

describe("feature-resources", () => {
  it("builds recharge map for fighter features", () => {
    const map = featureRechargeMap([{ class: "Fighter", level: 2 }]);
    expect(map[featureResourceKey("Fighter", 1, "second-wind")]).toBe(
      "short_rest",
    );
    expect(map[featureResourceKey("Fighter", 2, "action-surge")]).toBe(
      "short_rest",
    );
  });

  it("spends and counts remaining uses", () => {
    expect(remainingFeatureUses(undefined, 2)).toBe(2);
    const spent = spendFeatureUse(undefined, 2);
    expect(spent).toEqual([true, false]);
    expect(remainingFeatureUses(spent!, 2)).toBe(1);
    expect(spendFeatureUse([true, true], 2)).toBeNull();
  });

  it("refreshes short-rest features on short rest", () => {
    const key = featureResourceKey("Fighter", 1, "second-wind");
    const recharge = { [key]: "short_rest" as const };
    const refreshed = refreshResourceUsesOnRest(
      { [key]: [true] },
      recharge,
      "short_rest",
    );
    expect(refreshed[key]).toEqual([false]);
  });

  it("refreshes all keyed features on long rest", () => {
    const shortKey = featureResourceKey("Fighter", 1, "second-wind");
    const longKey = featureResourceKey("Fighter", 9, "indomitable");
    const recharge = {
      [shortKey]: "short_rest" as const,
      [longKey]: "long_rest" as const,
    };
    const refreshed = refreshResourceUsesOnRest(
      { [shortKey]: [true], [longKey]: [true] },
      recharge,
      "long_rest",
    );
    expect(refreshed[shortKey]).toEqual([false]);
    expect(refreshed[longKey]).toEqual([false]);
  });
});
