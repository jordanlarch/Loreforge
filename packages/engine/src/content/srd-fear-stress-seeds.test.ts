import { describe, expect, it } from "vitest";

import { validateFearStressDefinition } from "./toolbox-definitions";
import {
  fearStressAppliesFrightened,
  fearStressNeedsRepeatTick,
  fearStressPsychicDamage,
  isProlongedFearStressSlug,
  SRD_FEAR_STRESS_SEEDS,
} from "./srd-fear-stress-seeds";

describe("srd-fear-stress-seeds", () => {
  it("validates every registry seed", () => {
    for (const seed of SRD_FEAR_STRESS_SEEDS) {
      expect(validateFearStressDefinition(seed.definition)).toEqual([]);
    }
  });

  it("classifies fear vs stress entries", () => {
    const sarcophagus = SRD_FEAR_STRESS_SEEDS.find(
      (s) => s.slug === "srd-2024_sarcophagus-apparition",
    )!.definition;
    const hallucinogen = SRD_FEAR_STRESS_SEEDS.find(
      (s) => s.slug === "srd-2024_hallucinogenic-substance",
    )!.definition;

    expect(fearStressAppliesFrightened(sarcophagus)).toBe(true);
    expect(fearStressNeedsRepeatTick(sarcophagus)).toBe(true);
    expect(fearStressPsychicDamage(sarcophagus)).toBeUndefined();

    expect(fearStressAppliesFrightened(hallucinogen)).toBe(false);
    expect(fearStressPsychicDamage(hallucinogen)).toEqual({
      dice: "1d6",
      type: "psychic",
    });
  });

  it("flags prolonged stress slugs", () => {
    expect(isProlongedFearStressSlug("srd-2024_short-term-mental-stress")).toBe(
      true,
    );
    expect(isProlongedFearStressSlug("srd-2024_sarcophagus-apparition")).toBe(
      false,
    );
  });
});
