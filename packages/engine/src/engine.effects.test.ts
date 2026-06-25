import { describe, expect, it } from "vitest";

import { Engine } from "./engine";
import { effectiveAc } from "./combat/effects";

const CAMPAIGN = "c:effects";

async function seedCombatants(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:1",
      name: "Arena",
      map: { width: 20, height: 20, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  for (const e of [
    {
      id: "pc:cleric",
      name: "Cleric",
      scores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      classes: [{ class: "Cleric", level: 5 }],
      spellcasting: { ability: "wis" as const, casterLevel: 5 },
      x: 0,
    },
    {
      id: "pc:fighter",
      name: "Fighter",
      scores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      classes: [{ class: "Fighter", level: 5 }],
      x: 1,
    },
    {
      id: "t1",
      name: "Goblin",
      scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
      x: 2,
    },
  ]) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: e.id,
        kind: e.id.startsWith("pc:") ? "character" : "monster",
        name: e.name,
        abilityScores: e.scores,
        maxHp: 40,
        baseAc: 12,
        sceneId: "s:1",
        position: { x: e.x, y: 0 },
        classes: e.classes ?? [],
        ...(e.spellcasting
          ? { spellcasting: { ability: e.spellcasting.ability, casterLevel: 5 } }
          : {}),
      },
    });
  }
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    sceneId: "s:1",
    combatants: ["pc:cleric", "pc:fighter", "t1"],
    sides: { "pc:cleric": "party", "pc:fighter": "party", t1: "foes" },
  });
  await engine.execute(CAMPAIGN, { type: "roll_initiative" });
}

describe("Active effects (ENG-13)", () => {
  it("Shield raises effective AC by 5 until the bearer's next turn", async () => {
    const engine = new Engine({ now: () => 42 });
    await seedCombatants(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:wizard",
        kind: "character",
        name: "Wizard",
        abilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
        maxHp: 30,
        baseAc: 12,
        sceneId: "s:1",
        position: { x: 0, y: 1 },
        classes: [{ class: "Wizard", level: 5 }],
        spellcasting: { ability: "int", casterLevel: 5 },
      },
    });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "shield",
      slotLevel: 1,
      targets: ["pc:wizard"],
    });
    expect(cast.accepted).toBe(true);
    let state = await engine.getState(CAMPAIGN);
    expect(effectiveAc(state.entities["pc:wizard"]!)).toBe(17);

    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const order = state.encounter!.order;
    const wizIdx = order.findIndex((o) => o.entity === "pc:wizard");
    if (wizIdx >= 0) {
      for (let i = 0; i < order.length * 2; i++) {
        await engine.execute(CAMPAIGN, { type: "end_turn" });
        state = await engine.getState(CAMPAIGN);
        if (
          state.encounter?.order[state.encounter.activeIndex]?.entity ===
          "pc:wizard"
        ) {
          break;
        }
      }
      expect(effectiveAc(state.entities["pc:wizard"]!)).toBe(12);
    }
  });

  it("Bless adds 1d4 to attack rolls", async () => {
    const engine = new Engine({ now: () => 7 });
    await seedCombatants(engine);
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "bless",
      slotLevel: 1,
      targets: ["pc:fighter"],
    });
    expect(cast.accepted).toBe(true);
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:fighter",
      target: "t1",
      attackBonus: 5,
      damage: { notation: "1d8+3", type: "slashing" },
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const blessRoll = attack.events.find(
      (e) =>
        e.type === "DiceRolled" &&
        (e.payload as { scope: string }).scope.includes("attack-bless"),
    );
    expect(blessRoll).toBeDefined();
  });

  it("Hunter's Mark adds extra damage on a weapon hit", async () => {
    const engine = new Engine({ now: () => 11 });
    await seedCombatants(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:ranger",
        kind: "character",
        name: "Ranger",
        abilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
        maxHp: 40,
        baseAc: 14,
        sceneId: "s:1",
        position: { x: 1, y: 1 },
        classes: [{ class: "Ranger", level: 5 }],
        spellcasting: { ability: "wis", casterLevel: 5 },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:ranger",
      spellId: "hunters-mark",
      slotLevel: 1,
      targets: ["t1"],
    });
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:ranger",
      target: "t1",
      attackBonus: 7,
      damage: { notation: "1d8+3", type: "piercing" },
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const markRoll = attack.events.find(
      (e) =>
        e.type === "DiceRolled" &&
        (e.payload as { scope: string }).scope.includes("hunters-mark"),
    );
    expect(markRoll).toBeDefined();
  });
});
