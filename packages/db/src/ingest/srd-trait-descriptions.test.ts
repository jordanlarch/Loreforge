import { traitDescription } from "@app/db";
import { describe, expect, it } from "vitest";

describe("traitDescription", () => {
  it("returns SRD text for known traits", () => {
    expect(traitDescription("Darkvision")).toContain("60 feet");
    expect(traitDescription("Lucky")).toContain("reroll");
  });

  it("returns undefined for unknown traits", () => {
    expect(traitDescription("Unknown Trait XYZ")).toBeUndefined();
  });
});
