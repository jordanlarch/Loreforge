import { describe, expect, it } from "vitest";

import {
  parseCharacterNotes,
  serializeCharacterNotes,
  patchCharacterMeta,
} from "./character-sheet-storage";

describe("character-sheet-storage", () => {
  it("round-trips session notes, personality, and meta", () => {
    const raw = serializeCharacterNotes(
      "Session log entry",
      { traits: "Brave", ideals: "", bonds: "", flaws: "" },
      { inspiration: true, currentHp: 12 },
    );
    const parsed = parseCharacterNotes(raw);
    expect(parsed.sessionNotes).toBe("Session log entry");
    expect(parsed.personality.traits).toBe("Brave");
    expect(parsed.meta.inspiration).toBe(true);
    expect(parsed.meta.currentHp).toBe(12);
  });

  it("patches meta without losing personality", () => {
    const base = serializeCharacterNotes(
      "Notes",
      { traits: "x", ideals: "", bonds: "", flaws: "" },
      {},
    );
    const next = patchCharacterMeta(base, { tempHp: 5 });
    const parsed = parseCharacterNotes(next);
    expect(parsed.personality.traits).toBe("x");
    expect(parsed.meta.tempHp).toBe(5);
  });
});
