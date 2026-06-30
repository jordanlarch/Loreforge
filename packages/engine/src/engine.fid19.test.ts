import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:fid19";

async function createTarget(
  engine: Engine,
  id: string,
  opts: {
    maxHp?: number;
    damageResistances?: ("fire" | "cold")[];
    damageVulnerabilities?: ("fire" | "cold")[];
    damageImmunities?: ("fire" | "cold")[];
  } = {},
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp: opts.maxHp ?? 40,
      baseAc: 12,
      speed: 30,
      damageResistances: opts.damageResistances,
      damageVulnerabilities: opts.damageVulnerabilities,
      damageImmunities: opts.damageImmunities,
    },
  });
}

describe("SRD-FID-19: resistance / vulnerability / immunity", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 1 });
  });

  it("halves resisted damage via apply_damage", async () => {
    await createTarget(engine, "npc:ember-guard", {
      damageResistances: ["fire"],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "npc:ember-guard",
      damageType: "fire",
      source: { amount: 11 },
    });
    expect(result.accepted).toBe(true);
    const target = (await engine.getState(CAMPAIGN)).entities["npc:ember-guard"];
    expect(target?.hp.current).toBe(35); // floor(11/2) = 5
  });

  it("doubles vulnerable damage on attacks", async () => {
    await createTarget(engine, "npc:ice-sprite", {
      damageVulnerabilities: ["cold"],
    });
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["npc:ice-sprite"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    const result = await engine.execute(CAMPAIGN, {
      type: "attack",
      attacker: "npc:ice-sprite",
      target: "npc:ice-sprite",
      attackBonus: 20,
      damage: { notation: "1d1", type: "cold" },
    });
    expect(result.accepted).toBe(true);
    const target = (await engine.getState(CAMPAIGN)).entities["npc:ice-sprite"];
    expect(target?.hp.current).toBe(38); // 1 -> 2
  });

  it("negates immune damage", async () => {
    await createTarget(engine, "npc:golem", { damageImmunities: ["fire"] });
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "npc:golem",
      damageType: "fire",
      source: { amount: 20 },
    });
    expect(result.accepted).toBe(true);
    const target = (await engine.getState(CAMPAIGN)).entities["npc:golem"];
    expect(target?.hp.current).toBe(40);
  });
});

describe("SRD-FID-19: grant_temp_hp + False Life", () => {
  let engine: Engine;

  beforeEach(async () => {
    engine = new Engine({ now: () => 2 });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:wizard",
        kind: "character",
        name: "Wizard",
        abilityScores: ABILITIES,
        maxHp: 20,
        baseAc: 12,
        speed: 30,
        classes: [{ class: "Wizard", level: 3 }],
        spellcasting: { ability: "int" },
      },
    });
  });

  it("grant_temp_hp keeps the higher temp total", async () => {
    await engine.execute(CAMPAIGN, {
      type: "grant_temp_hp",
      target: "pc:wizard",
      source: { amount: 5 },
    });
    await engine.execute(CAMPAIGN, {
      type: "grant_temp_hp",
      target: "pc:wizard",
      source: { amount: 8 },
    });
    const wizard = (await engine.getState(CAMPAIGN)).entities["pc:wizard"];
    expect(wizard?.hp.temp).toBe(8);
  });

  it("temp HP soaks damage before current HP", async () => {
    await engine.execute(CAMPAIGN, {
      type: "grant_temp_hp",
      target: "pc:wizard",
      source: { amount: 6 },
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:wizard",
      damageType: "slashing",
      source: { amount: 10 },
    });
    const wizard = (await engine.getState(CAMPAIGN)).entities["pc:wizard"];
    expect(wizard?.hp.temp).toBe(0);
    expect(wizard?.hp.current).toBe(16);
  });

  it("False Life grants temp HP instead of healing current HP", async () => {
    const before = (await engine.getState(CAMPAIGN)).entities["pc:wizard"]!;
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:wizard",
      spellId: "false-life",
      targets: ["pc:wizard"],
      slotLevel: 1,
    });
    const after = (await engine.getState(CAMPAIGN)).entities["pc:wizard"]!;
    expect(after.hp.current).toBe(before.hp.current);
    expect(after.hp.temp).toBeGreaterThan(0);
  });
});
