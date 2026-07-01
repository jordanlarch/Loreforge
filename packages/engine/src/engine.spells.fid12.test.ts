import { beforeEach, describe, expect, it } from "vitest";

import { defaultPolymorphBeast } from "./spells/fid12-spells";
import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";

const CAMPAIGN = "c:fid12";

const CASTER_SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 18,
  wis: 18,
  cha: 10,
};

async function setupScene(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:arena",
      name: "Arena",
      map: { width: 20, height: 20, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
}

async function place(
  engine: Engine,
  id: string,
  position: GridPosition,
  extra: Record<string, unknown> = {},
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: CASTER_SCORES,
      maxHp: 80,
      baseAc: 10,
      speed: 30,
      sceneId: "s:arena",
      position,
      classes: id.startsWith("pc")
        ? [{ class: "Cleric", level: 5 }]
        : undefined,
      spellcasting: id.startsWith("pc")
        ? { ability: "wis", casterLevel: 5 }
        : undefined,
      ...extra,
    },
  });
}

describe("SRD-FID-12: Spiritual Weapon", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:cleric", { x: 0, y: 0 });
    await place(engine, "npc:foe", { x: 2, y: 0 }, { baseAc: 1, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:cleric", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:cleric": 20, "npc:foe": 0 },
    });
  });

  it("summons a persistent weapon on cast", async () => {
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "spiritual-weapon",
      slotLevel: 2,
      targets: ["npc:foe"],
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");
    expect(cast.events.some((e) => e.type === "SpiritualWeaponSummoned")).toBe(
      true,
    );
    const cleric = (await engine.getState(CAMPAIGN)).entities["pc:cleric"]!;
    expect(cleric.activeSpiritualWeapon?.roundsRemaining).toBe(10);
  });

  it("strike_spiritual_weapon spends bonus action and deals force damage", async () => {
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "spiritual-weapon",
      slotLevel: 2,
      targets: ["npc:foe"],
    });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const foeBefore = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    const strike = await engine.execute(CAMPAIGN, {
      type: "strike_spiritual_weapon",
      caster: "pc:cleric",
      target: "npc:foe",
    });
    expect(strike.accepted).toBe(true);
    if (!strike.accepted) throw new Error("strike failed");
    expect(strike.events.some((e) => e.type === "AttackResolved")).toBe(true);
    const foeAfter = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    expect(foeAfter.hp.current).toBeLessThan(foeBefore.hp.current);
    const cleric = (await engine.getState(CAMPAIGN)).entities["pc:cleric"]!;
    expect(cleric.actionEconomy?.bonusAction).toBe("used");
  });
});

describe("SRD-FID-12: Wall of Fire zone", () => {
  it("creates a persistent spell zone on cast", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:wizard", { x: 0, y: 0 }, {
      classes: [{ class: "Wizard", level: 9 }],
      spellcasting: { ability: "int", casterLevel: 9 },
    });
    await place(engine, "npc:foe", { x: 5, y: 0 }, { baseAc: 10, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:wizard", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:wizard": 20, "npc:foe": 0 },
    });

    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "wall-of-fire",
      slotLevel: 4,
      targets: [],
      origin: { x: 5, y: 0 },
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");
    expect(cast.events.some((e) => e.type === "SpellZoneCreated")).toBe(true);
    const scene = (await engine.getState(CAMPAIGN)).scenes["s:arena"]!;
    expect(scene.spellZones?.some((z) => z.spellId === "wall-of-fire")).toBe(
      true,
    );
  });
});

describe("SRD-FID-12: Polymorph", () => {
  it("swaps target stats to beast form on a willing ally", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:druid", { x: 0, y: 0 }, {
      classes: [{ class: "Druid", level: 7 }],
      spellcasting: { ability: "wis", casterLevel: 7 },
    });
    await place(engine, "pc:ally", { x: 1, y: 0 }, {
      classes: [{ class: "Fighter", level: 5 }],
      maxHp: 50,
      baseAc: 16,
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:druid", "pc:ally"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:druid": 20, "pc:ally": 0 },
    });

    const allyBefore = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:druid",
      spellId: "polymorph",
      slotLevel: 4,
      targets: ["pc:ally"],
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");
    expect(cast.events.some((e) => e.type === "PolymorphApplied")).toBe(true);

    const beast = defaultPolymorphBeast();
    const allyAfter = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(allyAfter.polymorph?.beastSlug).toBe("wolf");
    expect(allyAfter.hp.max).toBe(beast.maxHp);
    expect(allyAfter.baseAc).toBe(beast.baseAc);
    expect(allyAfter.polymorph?.storedMaxHp).toBe(allyBefore.hp.max);
  });
});

describe("SRD-FID-12: Moonbeam zone", () => {
  it("creates a persistent zone and ticks radiant damage on turn start", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:druid", { x: 0, y: 0 }, {
      classes: [{ class: "Druid", level: 5 }],
      spellcasting: { ability: "wis", casterLevel: 5 },
    });
    await place(engine, "npc:foe", { x: 3, y: 0 }, { baseAc: 10, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:druid", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:druid": 20, "npc:foe": 0 },
    });

    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:druid",
      spellId: "moonbeam",
      slotLevel: 2,
      targets: [],
      origin: { x: 3, y: 0 },
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");

    const foeBefore = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    const endTurn = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(endTurn.accepted).toBe(true);
    if (!endTurn.accepted) throw new Error("end turn failed");
    expect(endTurn.events.some((e) => e.type === "SaveRolled")).toBe(true);
    const foeAfter = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    expect(foeAfter.hp.current).toBeLessThan(foeBefore.hp.current);
  });
});

describe("SRD-FID-12: Call Lightning", () => {
  it("creates a storm cloud zone and strike_call_lightning spends action", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:druid", { x: 0, y: 0 }, {
      classes: [{ class: "Druid", level: 5 }],
      spellcasting: { ability: "wis", casterLevel: 5 },
    });
    await place(engine, "npc:foe", { x: 3, y: 0 }, { baseAc: 10, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:druid", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:druid": 20, "npc:foe": 0 },
    });

    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:druid",
      spellId: "call-lightning",
      slotLevel: 3,
      targets: [],
      origin: { x: 3, y: 0 },
    });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    await engine.execute(CAMPAIGN, { type: "end_turn" });

    const foeBefore = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    const strike = await engine.execute(CAMPAIGN, {
      type: "strike_call_lightning",
      caster: "pc:druid",
      target: "npc:foe",
    });
    expect(strike.accepted).toBe(true);
    if (!strike.accepted) throw new Error("strike failed");
    expect(strike.events.some((e) => e.type === "SaveRolled")).toBe(true);
    const foeAfter = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    expect(foeAfter.hp.current).toBeLessThan(foeBefore.hp.current);
    const druid = (await engine.getState(CAMPAIGN)).entities["pc:druid"]!;
    expect(druid.actionEconomy?.action).toBe("used");
  });
});

describe("SRD-FID-12: Spirit Guardians", () => {
  it("ticks radiant damage on hostile turn start within 15 ft", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:cleric", { x: 0, y: 0 });
    await place(engine, "npc:foe", { x: 2, y: 0 }, { baseAc: 10, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:cleric", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:cleric": 20, "npc:foe": 0 },
    });

    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "spirit-guardians",
      slotLevel: 3,
      targets: [],
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");
    expect(cast.events.some((e) => e.type === "SpiritGuardiansStarted")).toBe(
      true,
    );

    const foeBefore = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    const endTurn = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(endTurn.accepted).toBe(true);
    if (!endTurn.accepted) throw new Error("end turn failed");
    expect(endTurn.events.some((e) => e.type === "SaveRolled")).toBe(true);
    const foeAfter = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    expect(foeAfter.hp.current).toBeLessThan(foeBefore.hp.current);
  });
});

describe("SRD-FID-12: Cloudkill zone", () => {
  it("creates a persistent poison cloud and ticks on turn start", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:wizard", { x: 0, y: 0 }, {
      classes: [{ class: "Wizard", level: 9 }],
      spellcasting: { ability: "int", casterLevel: 9 },
    });
    await place(
      engine,
      "npc:foe",
      { x: 3, y: 0 },
      {
        baseAc: 10,
        maxHp: 200,
        abilityScores: { ...CASTER_SCORES, con: 1 },
      },
    );
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:wizard", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:wizard": 20, "npc:foe": 0 },
    });

    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "cloudkill",
      slotLevel: 5,
      targets: [],
      origin: { x: 3, y: 0 },
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) throw new Error("cast failed");

    const foeBefore = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const foeAfter = (await engine.getState(CAMPAIGN)).entities["npc:foe"]!;
    expect(foeAfter.hp.current).toBeLessThan(foeBefore.hp.current);
    const scene = (await engine.getState(CAMPAIGN)).scenes["s:arena"]!;
    expect(scene.spellZones?.some((z) => z.spellId === "cloudkill")).toBe(true);
  });
});

describe("SRD-FID-12: Stinking Cloud zone", () => {
  it("runs a turn-start save when a creature starts in the cloud", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:wizard", { x: 0, y: 0 }, {
      classes: [{ class: "Wizard", level: 5 }],
      spellcasting: { ability: "int", casterLevel: 5 },
    });
    await place(engine, "npc:foe", { x: 3, y: 0 }, { baseAc: 10, maxHp: 200 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:wizard", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:wizard": 20, "npc:foe": 0 },
    });

    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "stinking-cloud",
      slotLevel: 3,
      targets: [],
      origin: { x: 3, y: 0 },
    });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const endTurn = await engine.execute(CAMPAIGN, { type: "end_turn" });
    expect(endTurn.accepted).toBe(true);
    if (!endTurn.accepted) throw new Error("end turn failed");
    expect(endTurn.events.some((e) => e.type === "SaveRolled")).toBe(true);
  });
});

describe("SRD-FID-12: Haste depth", () => {
  it("grants an extra action on the hasted creature's turn", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:wizard", { x: 0, y: 0 }, {
      classes: [{ class: "Wizard", level: 5 }],
      spellcasting: { ability: "int", casterLevel: 5 },
    });
    await place(engine, "pc:ally", { x: 1, y: 0 }, {
      classes: [{ class: "Fighter", level: 5 }],
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:wizard", "pc:ally"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:wizard": 20, "pc:ally": 10 },
    });

    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "haste",
      slotLevel: 3,
      targets: ["pc:ally"],
    });
    await engine.execute(CAMPAIGN, { type: "end_turn" });
    const ally = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(ally.actionEconomy?.extraAction).toBe("available");

    const dash = await engine.execute(CAMPAIGN, {
      type: "dash",
      entity: "pc:ally",
    });
    expect(dash.accepted).toBe(true);
    if (!dash.accepted) throw new Error("dash failed");
    const afterDash = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(afterDash.actionEconomy?.action).toBe("used");
    expect(afterDash.actionEconomy?.extraAction).toBe("available");

    const dash2 = await engine.execute(CAMPAIGN, {
      type: "dash",
      entity: "pc:ally",
    });
    expect(dash2.accepted).toBe(true);
  });
});
