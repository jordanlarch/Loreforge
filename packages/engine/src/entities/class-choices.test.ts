import { describe, expect, it } from "vitest";

import {
  fightingStyleDescription,
  FIGHTING_STYLE_DESCRIPTIONS,
} from "./class-choices";

describe("fightingStyleDescription", () => {
  it("returns SRD text for known styles", () => {
    expect(fightingStyleDescription("Archery")).toBe(
      FIGHTING_STYLE_DESCRIPTIONS.Archery,
    );
    expect(fightingStyleDescription("Defense")).toContain("+1 bonus to AC");
  });

  it("returns undefined for unknown labels", () => {
    expect(fightingStyleDescription("Unknown")).toBeUndefined();
  });
});
