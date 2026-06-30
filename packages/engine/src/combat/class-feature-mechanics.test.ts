import { describe, expect, it } from "vitest";

import {
  agonizingBlastBonus,
  bardicInspirationDie,
  championCritThreshold,
  classLevel,
  discipleOfLifeBonus,
  distantSpellRange,
  focusPointMaximum,
  hasClassSubclass,
  hasEldritchInvocation,
  METAMAGIC_OPTIONS,
  naturalRecoveryMaximum,
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

  it("normalizes the expanded Metamagic catalog with Sorcery Point costs", () => {
    expect(
      selectedMetamagicOptions({
        "Sorcerer:2:metamagic": "Quickened Spell, Distant Spell, Seeking Spell",
      }),
    ).toEqual(["quickened", "distant", "seeking"]);
    expect(METAMAGIC_OPTIONS.quickened.cost).toBe(2);
    expect(METAMAGIC_OPTIONS.distant.cost).toBe(1);
    expect(METAMAGIC_OPTIONS.seeking.cost).toBe(2);
    expect(METAMAGIC_OPTIONS.subtle.cost).toBe(1);
    expect(METAMAGIC_OPTIONS.extended.cost).toBe(1);
  });

  it("computes Distant Spell range (touch → 30 ft, else doubled)", () => {
    expect(distantSpellRange(5, true)).toBe(30);
    expect(distantSpellRange(120, false)).toBe(240);
  });

  it("Champion crit threshold and Natural Recovery budget", () => {
    expect(
      championCritThreshold([{ class: "Fighter", level: 5, subclass: "Champion" }]),
    ).toBe(19);
    expect(
      championCritThreshold([{ class: "Fighter", level: 15, subclass: "Champion" }]),
    ).toBe(18);
    expect(championCritThreshold([{ class: "Fighter", level: 5 }])).toBeUndefined();
    expect(naturalRecoveryMaximum(5)).toBe(3);
    expect(naturalRecoveryMaximum(1)).toBe(0);
  });

  it("detects a class subclass and Disciple of Life healing bonus", () => {
    const classes = [{ class: "Cleric", level: 5, subclass: "Life Domain" }];
    expect(hasClassSubclass(classes, "Cleric", "Life Domain")).toBe(true);
    expect(hasClassSubclass(classes, "Cleric", "Light Domain")).toBe(false);
    expect(hasClassSubclass(classes, "Druid", "Life Domain")).toBe(false);
    expect(hasClassSubclass([{ class: "Cleric", level: 5 }], "Cleric", "Life Domain")).toBe(
      false,
    );
    expect(discipleOfLifeBonus(0)).toBe(0);
    expect(discipleOfLifeBonus(1)).toBe(3);
    expect(discipleOfLifeBonus(3)).toBe(5);
  });

  it("reads the expanded Eldritch Invocation catalog", () => {
    const choices = {
      "Warlock:1:eldritch-invocations":
        "Repelling Blast, Eldritch Spear, Eldritch Mind",
    };
    expect(hasEldritchInvocation(choices, "repelling-blast")).toBe(true);
    expect(hasEldritchInvocation(choices, "eldritch-spear")).toBe(true);
    expect(hasEldritchInvocation(choices, "eldritch-mind")).toBe(true);
    expect(hasEldritchInvocation(choices, "devils-sight")).toBe(false);
  });
});
