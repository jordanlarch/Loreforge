import { describe, expect, it } from "vitest";

import {
  checkProficiencyBonus,
  isCheckProficient,
  isToolProficient,
  isWeaponProficient,
  weaponProficiencyBonus,
} from "./entities/abilities";
import { createEntityState } from "./entities/abilities";
import { isProficientWithWeapon } from "./content/weapon-proficiency";
import { Engine } from "./engine";
import type { CheckRolledPayload } from "./events/types";

function entity(over: Parameters<typeof createEntityState>[0]) {
  return createEntityState(over);
}

describe("weapon proficiency (SRD-FID-16)", () => {
  it("matches specific weapons and category labels", () => {
    expect(
      isProficientWithWeapon(["Martial Weapons"], "Longsword"),
    ).toBe(true);
    expect(
      isProficientWithWeapon(["Simple Weapons"], "Shortbow"),
    ).toBe(true);
    expect(
      isProficientWithWeapon(["Dagger"], "Dagger"),
    ).toBe(true);
    expect(
      isProficientWithWeapon(["Simple Weapons"], "Longsword"),
    ).toBe(false);
  });

  it("adds proficiency bonus only when proficient", () => {
    const fighter = entity({
      id: "pc:fighter",
      kind: "character",
      name: "Fighter",
      abilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 30,
      baseAc: 16,
      classes: [{ class: "Fighter", level: 5 }],
      weaponProficiencies: ["Longsword"],
    });
    expect(isWeaponProficient(fighter, "Longsword")).toBe(true);
    expect(weaponProficiencyBonus(fighter, "Longsword")).toBe(3);
    expect(weaponProficiencyBonus(fighter, "Longbow")).toBe(0);
  });
});

describe("tool proficiency (SRD-FID-16)", () => {
  it("detects tool checks via isCheckProficient", () => {
    const bard = entity({
      id: "pc:bard",
      kind: "character",
      name: "Bard",
      abilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
      maxHp: 20,
      baseAc: 13,
      classes: [{ class: "Bard", level: 3 }],
      toolProficiencies: ["Lute"],
    });
    expect(isToolProficient(bard, "Lute")).toBe(true);
    expect(isCheckProficient(bard, "Lute")).toBe(true);
    expect(checkProficiencyBonus(bard, "Lute")).toBe(2);
    expect(isCheckProficient(bard, "Thieves' Tools")).toBe(false);
  });
});

describe("ability_check tool proficiency integration", () => {
  const CAMPAIGN = "fid16-tool-check";
  const SCENE = "s:1";

  function lastCheck(events: { type: string; payload: unknown }[]): CheckRolledPayload {
    const event = [...events].reverse().find((e) => e.type === "CheckRolled");
    if (!event) throw new Error("no CheckRolled event");
    return event.payload as CheckRolledPayload;
  }

  it("auto-detects tool proficiency on ability_check", async () => {
    const engine = new Engine({ now: () => 0 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: SCENE, name: "Workshop" },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:artisan",
        kind: "character",
        name: "Artisan",
        abilityScores: { str: 10, dex: 14, con: 10, int: 12, wis: 10, cha: 8 },
        maxHp: 20,
        baseAc: 12,
        sceneId: SCENE,
        classes: [{ class: "Rogue", level: 3 }],
        toolProficiencies: ["Thieves' Tools"],
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:artisan",
      ability: "dex",
      skill: "Thieves' Tools",
      dc: 5,
    });
    const check = lastCheck(await engine.getEvents(CAMPAIGN));
    expect(check.proficient).toBe(true);
    expect(check.total).toBe(check.natural + 2 + 2); // DEX +2, prof +2 at level 3
  });
});
