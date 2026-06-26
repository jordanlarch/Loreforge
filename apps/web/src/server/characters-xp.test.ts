import { describe, expect, it } from "vitest";

import { xpProgress } from "@app/engine";

describe("level-up XP gate", () => {
  it("requires cumulative XP for the next level", () => {
    expect(xpProgress(299, 1).canLevelUp).toBe(false);
    expect(xpProgress(300, 1).canLevelUp).toBe(true);
    expect(xpProgress(899, 2).canLevelUp).toBe(false);
    expect(xpProgress(900, 2).canLevelUp).toBe(true);
  });
});
