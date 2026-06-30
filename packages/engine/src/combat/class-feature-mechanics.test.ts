import { describe, expect, it } from "vitest";

import {
  agonizingBlastBonus,
  bardicInspirationDie,
  classLevel,
  focusPointMaximum,
  hasEldritchInvocation,
  rageDamageBonus,
  selectedMetamagicOptions,
  sneakAttackDiceCount,
  sneakAttackEligible,
  sneakAttackNotation,
  sorceryPointMaximum,
  stunningStrikeSaveDc,
} from "./class-feature-mechanics";
import type { EntityState } from "../entities/types";

const baseEntity = (id: string, pos: { x: number; y: number }): EntityState =>
  ({
    id,
    kind: "character",
    name: id,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: { current: 20, max: 20, temp: 0 },
    baseAc: 10,
    speed: 30,
    classes: [],
    proficiencyBonus: 2,
    saveProficiencies: [],
    alive: true,
    dead: false,
    sceneId: "s:1",
    position: pos,
    conditions: [],
  }) as EntityState;

describe("class feature mechanics", () => {
  it("scales Sneak Attack dice by rogue level", () => {
    expect(sneakAttackDiceCount(1)).toBe(1);
    expect(sneakAttackDiceCount(3)).toBe(2);
    expect(sneakAttackNotation(5)).toBe("3d6");
  });

  it("scales Rage damage bonus by barbarian level", () => {
    expect(rageDamageBonus(4)).toBe(2);
    expect(rageDamageBonus(10)).toBe(3);
    expect(rageDamageBonus(17)).toBe(4);
  });

  it("scales Bardic Inspiration die by bard level", () => {
    expect(bardicInspirationDie(1)).toBe("1d6");
    expect(bardicInspirationDie(5)).toBe("1d8");
    expect(bardicInspirationDie(15)).toBe("1d12");
  });

  it("allows Sneak Attack with advantage on a finesse attack", () => {
    const rogue = {
      ...baseEntity("pc:rogue", { x: 0, y: 0 }),
      classes: [{ class: "Rogue", level: 3 }],
    };
    const target = baseEntity("npc:foe", { x: 1, y: 0 });
    expect(
      sneakAttackEligible(rogue, target, { entities: {} }, "advantage", {
        finesseOrRanged: true,
      }),
    ).toBe(true);
  });

  it("allows Sneak Attack when an ally is within 5 ft of the target", () => {
    const rogue = {
      ...baseEntity("pc:rogue", { x: 0, y: 0 }),
      classes: [{ class: "Rogue", level: 1 }],
    };
    const target = baseEntity("npc:foe", { x: 2, y: 0 });
    const ally = baseEntity("pc:ally", { x: 3, y: 0 });
    expect(
      sneakAttackEligible(
        rogue,
        target,
        { entities: { "pc:ally": ally } },
        "normal",
        { finesseOrRanged: true },
      ),
    ).toBe(true);
  });

  it("sums class levels for multiclass totals", () => {
    expect(
      classLevel(
        [
          { class: "Fighter", level: 2 },
          { class: "Rogue", level: 3 },
        ],
        "Rogue",
      ),
    ).toBe(3);
  });

  it("scales Focus Points and Sorcery Points by class level", () => {
    expect(focusPointMaximum(1)).toBe(0);
    expect(focusPointMaximum(2)).toBe(2);
    expect(focusPointMaximum(5)).toBe(5);
    expect(sorceryPointMaximum(1)).toBe(0);
    expect(sorceryPointMaximum(5)).toBe(5);
  });

  it("computes Stunning Strike save DC from WIS and proficiency", () => {
    const monk = baseEntity("pc:monk", { x: 0, y: 0 });
    monk.proficiencyBonus = 3;
    monk.abilityScores.wis = 16;
    expect(stunningStrikeSaveDc(monk)).toBe(14);
  });

  it("reads Metamagic and Invocations from featureChoices", () => {
    expect(
      selectedMetamagicOptions({
        "Sorcerer:2:metamagic": "Empowered Spell, Heightened Spell",
      }),
    ).toEqual(["empowered", "heightened"]);
    expect(
      hasEldritchInvocation(
        { "Warlock:1:eldritch-invocations": "Agonizing Blast" },
        "agonizing-blast",
      ),
    ).toBe(true);
    expect(agonizingBlastBonus({ ...baseEntity("x", { x: 0, y: 0 }).abilityScores, cha: 18 })).toBe(4);
  });
});
