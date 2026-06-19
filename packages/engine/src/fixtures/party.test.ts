import { describe, expect, it } from "vitest";

import {
  buildCharacterSheet,
  buildFixtureCampaign,
  FIXTURE_CHARACTERS,
} from "./party";

describe("buildCharacterSheet", () => {
  it("derives modifiers, proficiency, and saving throws", () => {
    const thorin = FIXTURE_CHARACTERS.find((c) => c.id === "pc:thorin")!;
    const sheet = buildCharacterSheet(thorin);
    expect(sheet.level).toBe(5);
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.abilityModifiers.str).toBe(3); // 17 → +3
    expect(sheet.initiative).toBe(1); // dex 12 → +1
    const strSave = sheet.savingThrows.find((s) => s.ability === "str")!;
    expect(strSave.proficient).toBe(true);
    expect(strSave.modifier).toBe(6); // +3 mod + 3 prof
    const intSave = sheet.savingThrows.find((s) => s.ability === "int")!;
    expect(intSave.proficient).toBe(false);
    expect(intSave.modifier).toBe(-1); // int 9 → -1, no prof
  });
});

describe("buildFixtureCampaign", () => {
  it("builds world state through the real command path", async () => {
    const { state } = await buildFixtureCampaign();
    expect(state.currentSceneId).toBe("scene:tavern");
    expect(Object.keys(state.entities)).toContain("pc:thorin");
    expect(Object.keys(state.entities)).toContain("pc:elara");
    expect(state.entities["pc:elara"]?.proficiencyBonus).toBe(2);
  });
});
