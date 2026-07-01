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
    expect(sheet.level).toBe(9);
    expect(sheet.proficiencyBonus).toBe(4);
    expect(sheet.abilityModifiers.str).toBe(3); // 17 → +3
    expect(sheet.initiative).toBe(1); // dex 12 → +1
    const strSave = sheet.savingThrows.find((s) => s.ability === "str")!;
    expect(strSave.proficient).toBe(true);
    expect(strSave.modifier).toBe(7); // +3 mod + 4 prof
    const intSave = sheet.savingThrows.find((s) => s.ability === "int")!;
    expect(intSave.proficient).toBe(false);
    expect(intSave.modifier).toBe(-1); // int 9 → -1, no prof
    const athletics = sheet.skills.find((s) => s.skill === "Athletics")!;
    expect(athletics.proficient).toBe(true);
    expect(athletics.modifier).toBe(7); // str +3 + prof 4
    const arcana = sheet.skills.find((s) => s.skill === "Arcana")!;
    expect(arcana.proficient).toBe(false);
    expect(arcana.modifier).toBe(-1);
  });
});

describe("buildFixtureCampaign", () => {
  it("builds world state through the real command path", async () => {
    const { state } = await buildFixtureCampaign();
    expect(state.currentSceneId).toBe("scene:tavern");
    expect(Object.keys(state.entities)).toContain("pc:thorin");
    expect(Object.keys(state.entities)).toContain("pc:galen");
    expect(state.entities["pc:galen"]?.proficiencyBonus).toBe(3);
  });
});
