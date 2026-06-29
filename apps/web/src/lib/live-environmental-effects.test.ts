import { describe, expect, it } from "vitest";

import {
  activeEnvironmentalEffectHudLabel,
  environmentalEffectLabel,
  formatSceneEnvironmentalEffects,
} from "./live-environmental-effects";

describe("live-environmental-effects", () => {
  it("resolves registry labels", () => {
    expect(environmentalEffectLabel("srd-2024_extreme-cold")).toBe("Extreme Cold");
  });

  it("formats scene ambient chips", () => {
    expect(
      formatSceneEnvironmentalEffects([
        "srd-2024_extreme-cold",
        "srd-2024_slippery-ice",
      ]),
    ).toBe("Extreme Cold, Slippery Ice");
  });

  it("formats active environmental HUD labels", () => {
    expect(
      activeEnvironmentalEffectHudLabel({
        instanceId: "env:pc:1:srd-2024_slippery-ice:0",
        effectSlug: "srd-2024_slippery-ice",
        pendingRepeat: true,
      }),
    ).toBe("Exposed — Slippery Ice");
  });
});
