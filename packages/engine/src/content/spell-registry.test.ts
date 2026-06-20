import { describe, expect, it } from "vitest";

import { SPELL_REGISTRY, getSpell } from "./spell-registry";
import { validateSpellDefinition } from "./spells";

describe("spell registry", () => {
  it("every authored spell is structurally valid", () => {
    for (const [id, def] of Object.entries(SPELL_REGISTRY)) {
      expect(def.id, `${id} id matches its key`).toBe(id);
      expect(validateSpellDefinition(def), `${id} validation`).toEqual([]);
    }
  });

  it("looks up by slug and returns undefined for unknown ids", () => {
    expect(getSpell("magic-missile")?.name).toBe("Magic Missile");
    expect(getSpell("guiding-bolt")?.name).toBe("Guiding Bolt");
    expect(getSpell("not-a-spell")).toBeUndefined();
  });
});
