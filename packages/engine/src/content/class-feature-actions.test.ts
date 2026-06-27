import { describe, expect, it } from "vitest";

import { createSeededRng } from "../rng/prng";
import { featureResourceKey } from "../entities/feature-resources";
import {
  resolveFeatureHeal,
  useClassFeature,
} from "./class-feature-actions";

describe("useClassFeature", () => {
  const key = featureResourceKey("Fighter", 1, "second-wind");

  it("heals 1d10 + fighter level on Second Wind", () => {
    const rng = createSeededRng("test-second-wind");
    const result = useClassFeature({
      characterId: "pc-1",
      classes: [{ class: "Fighter", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 10,
      maxHp: 44,
      rng,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("heal");
    expect(result.healAmount).toBeGreaterThan(0);
    expect(result.resourceUses[key]?.filter(Boolean)).toHaveLength(1);
  });

  it("rejects when no uses remain", () => {
    const result = useClassFeature({
      characterId: "pc-1",
      classes: [{ class: "Fighter", level: 5 }],
      featureKey: key,
      resourceUses: { [key]: [true] },
      currentHp: 10,
      maxHp: 44,
      rng: createSeededRng("x"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("resolveFeatureHeal", () => {
  it("adds class level for Second Wind", () => {
    const { amount } = resolveFeatureHeal(
      { kind: "heal", dice: "1d10", addClassLevel: true },
      5,
      createSeededRng("heal-seed"),
    );
    expect(amount).toBeGreaterThanOrEqual(6);
  });
});
