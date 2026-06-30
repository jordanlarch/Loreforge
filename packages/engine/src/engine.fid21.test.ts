import { beforeEach, describe, expect, it } from "vitest";

import { featureResourceKey } from "./entities/feature-resources";
import { useClassFeature } from "./content/class-feature-actions";
import { createSeededRng } from "./rng/prng";
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

const CAMPAIGN = "c:fid21";

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
  classes: { class: string; level: number }[],
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

describe("SRD-FID-21: Sneak Attack", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:rogue", { x: 0, y: 0 }, [{ class: "Rogue", level: 3 }]);
    await place(engine, "npc:foe", { x: 1, y: 0 }, []);
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:rogue", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
  });

  it("adds Sneak Attack dice on a qualifying hit", async () => {
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:rogue",
      target: "npc:foe",
      attackBonus: 20,
      damage: { notation: "1d1", type: "piercing" },
      mode: "advantage",
      finesseOrRanged: true,
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const resolved = attack.events.find((e) => e.type === "AttackResolved") as {
      payload: { sneakAttackDamage?: number; damage?: number };
    };
    expect(resolved.payload.sneakAttackDamage).toBeGreaterThan(0);
    expect(resolved.payload.damage).toBeGreaterThan(1);
  });
});

describe("SRD-FID-21: Rage", () => {
  it("useClassFeature returns resistance and damage-bonus effects", () => {
    const key = featureResourceKey("Barbarian", 1, "rage");
    const result = useClassFeature({
      characterId: "pc:barb",
      classes: [{ class: "Barbarian", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 40,
      rng: createSeededRng("rage"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selfEffects?.length).toBe(2);
    expect(result.selfEffects?.[0]?.modifier.type).toBe("damage_resistance");
    expect(result.selfEffects?.[1]?.modifier.type).toBe("rage_damage_bonus");
  });
});

describe("SRD-FID-21: Bardic Inspiration", () => {
  it("grants an inspiration die effect to an ally", () => {
    const key = featureResourceKey("Bard", 1, "bardic-inspiration");
    const result = useClassFeature({
      characterId: "pc:bard",
      classes: [{ class: "Bard", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 30,
      rng: createSeededRng("bi"),
      beneficiaryId: "pc:ally",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allyEffect?.effect.modifier.type).toBe("bardic_inspiration");
  });
});

describe("SRD-FID-21: Monk Focus & Stunning Strike", () => {
  it("Patient Defense spends a Focus Point", () => {
    const key = featureResourceKey("Monk", 2, "monk-s-focus");
    const result = useClassFeature({
      characterId: "pc:monk",
      classes: [{ class: "Monk", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 30,
      rng: createSeededRng("focus-pd"),
      monkFocusSpend: "patient_defense",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.startDodging).toBe(true);
  });

  it("Stunning Strike spends Focus and can Stun on failed save", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:monk", { x: 0, y: 0 }, [{ class: "Monk", level: 5 }], {
      abilityScores: { ...ABILITIES, wis: 16 },
      resourceUses: {},
    });
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], {
      abilityScores: { ...ABILITIES, con: 8 },
    });
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:monk",
      target: "npc:foe",
      attackBonus: 20,
      damage: { notation: "1d4", type: "bludgeoning" },
      stunningStrike: true,
      monkWeaponOrUnarmed: true,
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const resolved = attack.events.find((e) => e.type === "AttackResolved") as {
      payload: { stunningStrike?: boolean; hit: boolean };
    };
    expect(resolved.payload.hit).toBe(true);
    expect(resolved.payload.stunningStrike).toBe(true);
    const poolSpent = attack.events.some((e) => e.type === "FeaturePoolSpent");
    expect(poolSpent).toBe(true);
  });
});

describe("SRD-FID-21: Metamagic & Invocations", () => {
  it("Agonizing Blast adds Charisma modifier to Eldritch Blast", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    const CHA_SCORES = { ...ABILITIES, cha: 18 };
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:lock",
        kind: "character",
        name: "Warlock",
        abilityScores: CHA_SCORES,
        maxHp: 30,
        baseAc: 12,
        classes: [{ class: "Warlock", level: 5 }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: { ability: "cha" },
        featureChoices: {
          "Warlock:1:eldritch-invocations": "Agonizing Blast",
        },
      },
    });
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:lock",
      spellId: "eldritch-blast",
      slotLevel: 0,
      targets: ["npc:foe"],
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const resolved = cast.events.find((e) => e.type === "AttackResolved") as {
      payload: { damage?: number; hit: boolean };
    };
    expect(resolved.payload.hit).toBe(true);
    expect(resolved.payload.damage).toBeGreaterThanOrEqual(11);
  });

  it("Heightened Spell spends Sorcery Points and imposes save disadvantage", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:sorc",
        kind: "character",
        name: "Sorcerer",
        abilityScores: { ...ABILITIES, cha: 16 },
        maxHp: 30,
        baseAc: 12,
        classes: [{ class: "Sorcerer", level: 5 }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: { ability: "cha" },
        featureChoices: {
          "Sorcerer:2:metamagic": "Heightened Spell, Empowered Spell",
        },
        resourceUses: {},
      },
    });
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 10, maxHp: 100 });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:sorc",
      spellId: "shatter",
      slotLevel: 2,
      targets: [],
      origin: { x: 1, y: 0 },
      metamagic: "heightened",
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const spellCast = cast.events.find((e) => e.type === "SpellCast") as {
      payload: { metamagic?: string; sorceryPointsSpent?: number };
    };
    expect(spellCast.payload.metamagic).toBe("heightened");
    expect(spellCast.payload.sorceryPointsSpent).toBe(2);
    const save = cast.events.find((e) => e.type === "SaveRolled") as {
      payload: { mode: string };
    };
    expect(save.payload.mode).toBe("disadvantage");
  });
});

describe("SRD-FID-21: Metamagic expansion", () => {
  async function makeSorcerer(
    engine: Engine,
    metamagic: string,
    position: GridPosition = { x: 0, y: 0 },
  ) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:sorc",
        kind: "character",
        name: "Sorcerer",
        abilityScores: { ...ABILITIES, cha: 16 },
        maxHp: 30,
        baseAc: 12,
        classes: [{ class: "Sorcerer", level: 5 }],
        sceneId: "s:arena",
        position,
        spellcasting: { ability: "cha" },
        featureChoices: { "Sorcerer:2:metamagic": metamagic },
        resourceUses: {},
      },
    });
  }

  it("Quickened Spell converts an action cast to a bonus action and spends 2 SP", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await makeSorcerer(engine, "Quickened Spell, Empowered Spell");
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:sorc", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:sorc": 20, "npc:foe": 0 },
    });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:sorc",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:foe"],
      metamagic: "quickened",
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const spellCast = cast.events.find((e) => e.type === "SpellCast") as {
      payload: { bonusAction?: boolean; sorceryPointsSpent?: number };
    };
    expect(spellCast.payload.bonusAction).toBe(true);
    expect(spellCast.payload.sorceryPointsSpent).toBe(2);
    expect(cast.events.some((e) => e.type === "ActionSpent")).toBe(false);
  });

  it("Distant Spell extends range (rejected without, accepted with)", async () => {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:arena",
        name: "Arena",
        map: { width: 50, height: 4, blockedCells: [] },
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await makeSorcerer(engine, "Distant Spell, Empowered Spell");
    // 30 cells = 150 ft: beyond Fire Bolt's 120 ft, within Distant's 240 ft.
    await place(engine, "npc:foe", { x: 30, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    const without = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:sorc",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:foe"],
    });
    expect(without.accepted).toBe(false);
    if (!without.accepted) expect(without.reason.code).toBe("OUT_OF_RANGE");
    const withDistant = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:sorc",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:foe"],
      metamagic: "distant",
    });
    expect(withDistant.accepted).toBe(true);
  });

  it("Seeking Spell rerolls a missed spell attack", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await makeSorcerer(engine, "Seeking Spell, Empowered Spell");
    await place(engine, "npc:foe", { x: 1, y: 0 }, [], { baseAc: 99, maxHp: 100 });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:sorc",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:foe"],
      metamagic: "seeking",
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const resolved = cast.events.find((e) => e.type === "AttackResolved") as {
      payload: { hit: boolean };
    };
    expect(resolved.payload.hit).toBe(false);
    const reroll = cast.events.some(
      (e) =>
        e.type === "DiceRolled" &&
        String((e.payload as { scope: string }).scope).startsWith(
          "metamagic-seeking",
        ),
    );
    expect(reroll).toBe(true);
  });
});

describe("SRD-FID-21: Eldritch Invocation expansion", () => {
  async function makeWarlock(
    engine: Engine,
    invocations: string,
    extra: Record<string, unknown> = {},
  ) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:lock",
        kind: "character",
        name: "Warlock",
        abilityScores: { ...ABILITIES, cha: 18 },
        maxHp: 40,
        baseAc: 12,
        classes: [{ class: "Warlock", level: 5 }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: { ability: "cha" },
        featureChoices: { "Warlock:1:eldritch-invocations": invocations },
        ...extra,
      },
    });
  }

  it("Repelling Blast pushes an Eldritch Blast target 10 ft away", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await makeWarlock(engine, "Repelling Blast");
    await place(engine, "npc:foe", { x: 2, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:lock",
      spellId: "eldritch-blast",
      slotLevel: 0,
      targets: ["npc:foe"],
    });
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const moved = cast.events.find((e) => e.type === "EntityMoved") as {
      payload: { entity: string; to: GridPosition };
    };
    expect(moved.payload.entity).toBe("npc:foe");
    expect(moved.payload.to).toEqual({ x: 4, y: 0 });
  });

  it("Eldritch Spear extends Eldritch Blast range beyond 120 ft", async () => {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:arena",
        name: "Arena",
        map: { width: 50, height: 4, blockedCells: [] },
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:arena" });
    await makeWarlock(engine, "Eldritch Spear");
    // 30 cells = 150 ft: beyond the base 120 ft, within Eldritch Spear's 300 ft.
    await place(engine, "npc:foe", { x: 30, y: 0 }, [], { baseAc: 1, maxHp: 100 });
    const cast = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:lock",
      spellId: "eldritch-blast",
      slotLevel: 0,
      targets: ["npc:foe"],
    });
    expect(cast.accepted).toBe(true);
  });

  it("Eldritch Mind grants advantage on concentration saves", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await makeWarlock(engine, "Eldritch Mind");
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:lock",
      spell: "Hex",
    });
    const dmg = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:lock",
      damageType: "fire",
      source: { amount: 10 },
    });
    expect(dmg.accepted).toBe(true);
    if (!dmg.accepted) return;
    const save = dmg.events.find(
      (e) =>
        e.type === "SaveRolled" &&
        (e.payload as { ability: string }).ability === "con",
    ) as { payload: { mode: string } };
    expect(save.payload.mode).toBe("advantage");
  });
});

describe("SRD-FID-21b: Life Domain — Disciple of Life", () => {
  async function castCureWounds(engine: Engine, subclass?: string) {
    await setupScene(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:cleric",
        kind: "character",
        name: "Cleric",
        abilityScores: { ...ABILITIES, wis: 16 },
        maxHp: 40,
        baseAc: 14,
        classes: [{ class: "Cleric", level: 5, ...(subclass ? { subclass } : {}) }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: { ability: "wis" },
      },
    });
    await place(engine, "pc:ally", { x: 1, y: 0 }, [], { maxHp: 40 });
    // Drop the ally so the heal does not overheal.
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ally",
      damageType: "necrotic",
      source: { amount: 30 },
    });
    return engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
  }

  function healAmount(events: { type: string; payload: unknown }[]): {
    base: number;
    healed: number;
  } {
    const baseRoll = events.find(
      (e) =>
        e.type === "DiceRolled" &&
        String((e.payload as { scope: string }).scope).startsWith("spell-heal"),
    ) as { payload: { total: number } };
    const heal = events.find((e) => e.type === "HealingApplied") as {
      payload: { amount: number };
    };
    return { base: baseRoll.payload.total, healed: heal.payload.amount };
  }

  it("adds 2 + slot level when the Cleric is Life Domain", async () => {
    const engine = new Engine({ now: () => 1 });
    const cast = await castCureWounds(engine, "Life Domain");
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const { base, healed } = healAmount(cast.events);
    // 1d8 + WIS mod (+3) + Disciple of Life (2 + slot level 1 = 3).
    expect(healed).toBe(base + 3 + 3);
  });

  it("does not add the bonus without the Life Domain subclass", async () => {
    const engine = new Engine({ now: () => 1 });
    const cast = await castCureWounds(engine);
    expect(cast.accepted).toBe(true);
    if (!cast.accepted) return;
    const { base, healed } = healAmount(cast.events);
    expect(healed).toBe(base + 3);
  });
});

describe("SRD-FID-21: Paladin — Lay on Hands, Channel Divinity, Divine Smite", () => {
  it("Lay on Hands spends HP from the pool to heal", () => {
    const key = featureResourceKey("Paladin", 1, "lay-on-hands");
    const result = useClassFeature({
      characterId: "pc:pal",
      classes: [{ class: "Paladin", level: 5 }],
      featureKey: key,
      resourceUses: {},
      currentHp: 10,
      maxHp: 40,
      rng: createSeededRng("loh"),
      layOnHandsHealAmount: 8,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.healAmount).toBe(8);
    expect(result.resourceUses[key]?.filter(Boolean)).toHaveLength(8);
  });

  it("Sacred Weapon applies an attack-roll bonus effect", () => {
    const key = featureResourceKey("Paladin", 3, "channel-divinity");
    const result = useClassFeature({
      characterId: "pc:pal",
      classes: [{ class: "Paladin", level: 5, subclass: "Oath of Devotion" }],
      featureKey: key,
      resourceUses: {},
      currentHp: 20,
      maxHp: 40,
      rng: createSeededRng("cd-sw"),
      channelDivinitySpend: "sacred_weapon",
      abilityScores: { ...ABILITIES, cha: 16 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selfEffects?.[0]?.modifier.type).toBe("attack_roll_bonus");
  });

  it("Divine Smite adds radiant damage and expends a spell slot on hit", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:pal",
        kind: "character",
        name: "Paladin",
        abilityScores: ABILITIES,
        maxHp: 40,
        baseAc: 16,
        classes: [{ class: "Paladin", level: 5 }],
        sceneId: "s:arena",
        position: { x: 0, y: 0 },
        spellcasting: { ability: "cha", casterLevel: 2 },
      },
    });
    await place(engine, "npc:undead", { x: 1, y: 0 }, [], {
      creatureTypes: ["undead"],
      maxHp: 100,
    });
    const attack = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:pal",
      target: "npc:undead",
      attackBonus: 20,
      damage: { notation: "1d8", type: "slashing" },
      divineSmite: true,
      divineSmiteSlotLevel: 1,
    });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    const resolved = attack.events.find((e) => e.type === "AttackResolved") as {
      payload: { divineSmiteDamage?: number; damage?: number; hit: boolean };
    };
    expect(resolved.payload.hit).toBe(true);
    expect(resolved.payload.divineSmiteDamage).toBeGreaterThanOrEqual(3);
    expect(attack.events.some((e) => e.type === "SpellSlotExpended")).toBe(true);
  });

  it("Turn Undead frightens on a failed Wisdom save", async () => {
    const engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(engine, "pc:pal", { x: 0, y: 0 }, [{ class: "Paladin", level: 5 }], {
      abilityScores: { ...ABILITIES, cha: 18 },
      resourceUses: {},
    });
    await place(engine, "npc:zombie", { x: 1, y: 0 }, [], {
      creatureTypes: ["undead"],
      abilityScores: { ...ABILITIES, wis: 8 },
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:pal", "npc:zombie"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:pal": 20, "npc:zombie": 0 },
    });
    const key = featureResourceKey("Paladin", 3, "channel-divinity");
    const use = await engine.execute(CAMPAIGN, {
      type: "use_class_feature",
      entity: "pc:pal",
      featureKey: key,
      channelDivinitySpend: "turn_undead",
      beneficiaryId: "npc:zombie",
    });
    expect(use.accepted).toBe(true);
    if (!use.accepted) return;
    const frightened = use.events.some(
      (e) =>
        e.type === "ConditionApplied" &&
        (e.payload as { condition: string }).condition === "frightened",
    );
    expect(frightened).toBe(true);
  });
});

describe("SRD-FID-21: Action Surge", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setupScene(engine);
    await place(
      engine,
      "pc:fighter",
      { x: 0, y: 0 },
      [{ class: "Fighter", level: 5 }],
    );
    await place(engine, "npc:foe", { x: 1, y: 0 }, []);
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:fighter", "npc:foe"],
    });
    await engine.execute(CAMPAIGN, {
      type: "roll_initiative",
      bonuses: { "pc:fighter": 20, "npc:foe": 0 },
    });
  });

  it("grants a fresh action and Extra Attack budget", async () => {
    const key = featureResourceKey("Fighter", 2, "action-surge");
    for (let i = 0; i < 2; i += 1) {
      const atk = await engine.execute(CAMPAIGN, {
        type: "attack",
        attacker: "pc:fighter",
        target: "npc:foe",
        attackBonus: 10,
        damage: { notation: "1d1", type: "slashing" },
      });
      expect(atk.accepted).toBe(true);
    }
    const blocked = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:fighter",
      target: "npc:foe",
      attackBonus: 10,
      damage: { notation: "1d1", type: "slashing" },
    });
    expect(blocked.accepted).toBe(false);

    const surge = await engine.execute(CAMPAIGN, {
      type: "use_class_feature",
      entity: "pc:fighter",
      featureKey: key,
    });
    expect(surge.accepted).toBe(true);

    const fighter = (await engine.getState(CAMPAIGN)).entities["pc:fighter"]!;
    expect(fighter.actionEconomy?.action).toBe("available");
    expect(fighter.actionEconomy?.attacks.used).toBe(0);
    expect(fighter.actionEconomy?.attacks.total).toBe(2);

    const again = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "pc:fighter",
      target: "npc:foe",
      attackBonus: 10,
      damage: { notation: "1d1", type: "slashing" },
    });
    expect(again.accepted).toBe(true);
  });
});
