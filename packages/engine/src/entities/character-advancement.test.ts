import { describe, expect, it } from "vitest";

import { buildStartingCharacterStats } from "./character-advancement";

const spread = (
  str: number,
  dex: number,
  con: number,
  int: number,
  wis: number,
  cha: number,
) => ({ str, dex, con, int, wis, cha });

describe("buildStartingCharacterStats", () => {
  it("builds a level 4 fighter with average HP and level 4 XP", () => {
    const base = spread(15, 14, 14, 10, 12, 8);
    const result = buildStartingCharacterStats(10, 4, base, [
      { level: 2, hpMethod: "average" },
      { level: 3, hpMethod: "average" },
      { level: 4, hpMethod: "average", asi: { mode: "increase", ability: "str", amount: 2 } },
    ], "test-char");

    expect(result.abilityScores.str).toBe(17);
    expect(result.xp).toBe(2_700);
    expect(result.maxHp).toBeGreaterThan(12);
  });
});
