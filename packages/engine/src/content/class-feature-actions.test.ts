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
      resourceUses: { [key]: [true, true] },
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

describe("Rage and Bardic Inspiration (SRD-FID-21)", () => {
  it("returns rage self effects", () => {
    const key = featureResourceKey("Barbarian", 1, "rage");
    const result = useClassFeature({
      characterId: "pc:barb",
      classes: [{ class: "Barbarian", level: 9 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 10,
      maxHp: 40,
      rng: createSeededRng("rage-use"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("rage");
    expect(result.selfEffects?.[1]?.modifier).toEqual({
      type: "rage_damage_bonus",
      amount: 3,
    });
  });

  it("grants Bardic Inspiration to an ally", () => {
    const key = featureResourceKey("Bard", 1, "bardic-inspiration");
    const result = useClassFeature({
      characterId: "pc:bard",
      classes: [{ class: "Bard", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 10,
      maxHp: 30,
      rng: createSeededRng("bi-use"),
      beneficiaryId: "pc:ally",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allyEffect?.target).toBe("pc:ally");
  });
});

describe("Monk Focus (SRD-FID-21)", () => {
  const focusKey = featureResourceKey("Monk", 2, "monk-s-focus");

  it("spends Focus Point for Patient Defense", () => {
    const result = useClassFeature({
      characterId: "pc:monk",
      classes: [{ class: "Monk", level: 5 }],
      featureKey: focusKey,
      resourceUses: {},
      currentHp: 20,
      maxHp: 30,
      rng: createSeededRng("monk-pd"),
      monkFocusSpend: "patient_defense",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("monk_patient_defense");
    expect(result.startDodging).toBe(true);
    expect(result.resourceUses[focusKey]?.filter(Boolean)).toHaveLength(1);
  });

  it("grants Flurry bonus unarmed strikes", () => {
    const result = useClassFeature({
      characterId: "pc:monk",
      classes: [{ class: "Monk", level: 5 }],
      featureKey: focusKey,
      resourceUses: {},
      currentHp: 20,
      maxHp: 30,
      rng: createSeededRng("monk-flurry"),
      monkFocusSpend: "flurry",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bonusUnarmedAttacks).toBe(2);
    expect(result.unarmedDamageDie).toBe("1d6");
  });
});
