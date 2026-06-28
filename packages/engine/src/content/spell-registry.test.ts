import { describe, expect, it } from "vitest";

import { HAND_AUTHORED_SPELL_IDS, SPELL_REGISTRY, getSpell } from "./spell-registry";
import { validateSpellDefinition } from "./spells";

describe("spell registry", () => {
  it("every hand-authored spell is structurally valid", () => {
    for (const id of HAND_AUTHORED_SPELL_IDS) {
      const def = SPELL_REGISTRY[id]!;
      expect(def.id, `${id} id matches its key`).toBe(id);
      expect(validateSpellDefinition(def), `${id} validation`).toEqual([]);
    }
  });

  it("includes the full Open5e SRD catalog merged with hand-authored overrides", () => {
    expect(Object.keys(SPELL_REGISTRY).length).toBeGreaterThanOrEqual(300);
    expect(HAND_AUTHORED_SPELL_IDS.size).toBeGreaterThanOrEqual(120);
  });

  it("looks up by slug and returns undefined for unknown ids", () => {
    expect(getSpell("magic-missile")?.name).toBe("Magic Missile");
    expect(getSpell("guiding-bolt")?.name).toBe("Guiding Bolt");
    expect(getSpell("not-a-spell")).toBeUndefined();
  });
});
