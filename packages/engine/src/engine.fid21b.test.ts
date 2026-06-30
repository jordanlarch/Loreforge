import { beforeEach, describe, expect, it } from "vitest";

import { featureResourceKey } from "./entities/feature-resources";
import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 16,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 14,
};

const CAMPAIGN = "c:fid21b";

async function setupScene(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:arena",
      name: "Arena",
      map: { width: 10, height: 10, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
}

async function place(
  engine: Engine,
  id: string,
  position: GridPosition,
  classes: { class: string; level: number; subclass?: string }[],
  extra: Record<string, unknown> = {},
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp: 40,
      baseAc: 10,
      speed: 30,
      classes,
      sceneId: "s:arena",
      position,
      ...extra,
    },
  });
}

describe("SRD-FID-21b: Champion — Improved Critical", () => {
  it("crits on a natural 19 for a Champion Fighter", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(
      engine,
      "pc:champ",
      { x: 0, y: 0 },
      [{ class: "Fighter", level: 5, subclass: "Champion" }],
    );
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 15, maxHp: 100 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:champ", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:champ": 20, "npc:foe": 0 },
    });

    let foundCrit19 = false;
    for (let i = 0; i < 40; i += 1) {
      const attack = await engine.execute(CAMPAIGN, {
        type: "attack",
        attacker: "pc:champ",
        target: "npc:foe",
        attackBonus: 0,
        damage: { notation: "1d1", type: "slashing" },
      });
      if (!attack.accepted) continue;
      const resolved = attack.events.find((e) => e.type === "AttackResolved") as {
        payload: { critical: boolean; attackRoll: { natural: number } };
      };
      if (resolved.payload.attackRoll.natural === 19 && resolved.payload.critical) {
        foundCrit19 = true;
        break;
      }
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      if (i % 2 === 1) {
        await engine.execute(CAMPAIGN, { type: "end_turn" });
      }
    }
    expect(foundCrit19).toBe(true);
  });
});

describe("SRD-FID-21b: Berserker — Frenzy", () => {
  it("Frenzy Rage enables a bonus-action melee attack", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(
      engine,
      "pc:barb",
      { x: 0, y: 0 },
      [{ class: "Barbarian", level: 5, subclass: "Path of the Berserker" }],
      { resourceUses: {} },
    );
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:barb", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:barb": 20, "npc:foe": 0 },
    });
    const rageKey = featureResourceKey("Barbarian", 1, "rage");
    const rage = await engine.execute(CAMPAIGN, {
      type: "use_class_feature",
      entity: "pc:barb",
      featureKey: rageKey,
      rageFrenzy: true,
    });
    expect(rage.accepted).toBe(true);
    const frenzyAttack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:barb",
      target: "npc:foe",
      attackBonus: 10,
      damage: { notation: "1d8", type: "slashing" },
      usesStrength: true,
      frenzyBonusAttack: true,
    });
    expect(frenzyAttack.accepted).toBe(true);
    if (!frenzyAttack.accepted) return;
    const spent = frenzyAttack.events.find((e) => e.type === "ActionSpent") as {
      payload: { bonusAction?: boolean };
    };
    expect(spent.payload.bonusAction).toBe(true);
  });
});

describe("SRD-FID-21b: College of Lore — Cutting Words", () => {
  it("subtracts a Bardic Inspiration die from an attack total", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(
      engine,
      "pc:bard",
      { x: 0, y: 0 },
      [{ class: "Bard", level: 5, subclass: "College of Lore" }],
      { resourceUses: {}, proficiencyBonus: 3 },
    );
    await place(engine, "npc:foe", { x: 2, y: 0 }, [], { baseAc: 15 });
    const cw = await engine.execute(CAMPAIGN, {
      type: "cutting_words",
      reactor: "pc:bard",
      against: "npc:foe",
      mode: "attack",
      originalTotal: 18,
      natural: 15,
      targetAc: 16,
    });
    expect(cw.accepted).toBe(true);
    if (!cw.accepted) return;
    const applied = cw.events.find((e) => e.type === "CuttingWordsApplied") as {
      payload: { penalty: number; adjustedTotal: number; hit?: boolean };
    };
    expect(applied.payload.penalty).toBeGreaterThan(0);
    expect(applied.payload.adjustedTotal).toBeLessThan(18);
    expect(applied.payload.hit).toBe(false);
    expect(cw.events.some((e) => e.type === "ReactionTaken")).toBe(true);
  });
});

describe("SRD-FID-21b: Circle of the Land — Natural Recovery", () => {
  it("recovers expended spell slots on a Short Rest once per Long Rest", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:druid",
        kind: "character",
        name: "Druid",
        abilityScores: { ...ABILITIES, wis: 16 },
        maxHp: 30,
        baseAc: 12,
        classes: [{ class: "Druid", level: 5, subclass: "Circle of the Land" }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: {
          ability: "wis",
          preparedSpellIds: ["cure-wounds"],
        },
        resourceUses: {},
      },
    });
    await place(engine, "pc:ally", { x: 1, y: 0 }, [], { maxHp: 40 });
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ally",
      damageType: "slashing",
      source: { amount: 20 },
    });
    for (let i = 0; i < 2; i += 1) {
      const cast = await engine.execute(CAMPAIGN, {
        type: "cast_spell",
        caster: "pc:druid",
        spellId: "cure-wounds",
        slotLevel: 1,
        targets: ["pc:ally"],
      });
      expect(cast.accepted).toBe(true);
    }
    const rest = await engine.execute(CAMPAIGN, {
      type: "short_rest",
      entity: "pc:druid",
      naturalRecoverySlotLevels: [1, 1],
    });
    expect(rest.accepted).toBe(true);
    if (!rest.accepted) return;
    expect(rest.events.filter((e) => e.type === "SpellSlotRecovered")).toHaveLength(2);
    const again = await engine.execute(CAMPAIGN, {
      type: "short_rest",
      entity: "pc:druid",
      naturalRecoverySlotLevels: [1],
    });
    expect(again.accepted).toBe(false);
    if (again.accepted) return;
    expect(again.reason.code).toBe("ACTION_UNAVAILABLE");
  });
});
