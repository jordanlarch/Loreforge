import { describe, expect, it } from "vitest";

import { adjustDamageAmount } from "./damage";
import type { EntityState } from "../entities/types";

function entity(
  over: Pick<
    EntityState,
    "damageImmunities" | "damageResistances" | "damageVulnerabilities"
  >,
): EntityState {
  return over as EntityState;
}

describe("adjustDamageAmount", () => {
  it("returns zero for immunity", () => {
    expect(
      adjustDamageAmount(20, "fire", entity({ damageImmunities: ["fire"] })),
    ).toBe(0);
  });

  it("halves damage for resistance (round down)", () => {
    expect(
      adjustDamageAmount(11, "cold", entity({ damageResistances: ["cold"] })),
    ).toBe(5);
  });

  it("doubles damage for vulnerability", () => {
    expect(
      adjustDamageAmount(
        7,
        "radiant",
        entity({ damageVulnerabilities: ["radiant"] }),
      ),
    ).toBe(14);
  });

  it("cancels when both resistance and vulnerability apply", () => {
    expect(
      adjustDamageAmount(
        10,
        "lightning",
        entity({
          damageResistances: ["lightning"],
          damageVulnerabilities: ["lightning"],
        }),
      ),
    ).toBe(10);
  });

  it("matches damage types case-insensitively", () => {
    expect(
      adjustDamageAmount(10, "Fire", entity({ damageResistances: ["fire"] })),
    ).toBe(5);
  });
});
