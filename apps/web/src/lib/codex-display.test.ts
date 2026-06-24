import { describe, expect, it } from "vitest";

import { parseCodexCategory } from "./codex-categories";
import { abilityBonusLine, signed } from "./codex-display";

describe("codex-display", () => {
  it("formats ability bonuses", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(-1)).toBe("-1");
    expect(abilityBonusLine({ con: 2, wis: 1 })).toBe(
      "+2 Constitution, +1 Wisdom",
    );
  });
});

describe("codex-categories", () => {
  it("parses category from query param", () => {
    expect(parseCodexCategory("Species")).toBe("Species");
    expect(parseCodexCategory("bogus")).toBe("Spells");
    expect(parseCodexCategory(undefined)).toBe("Spells");
  });
});
