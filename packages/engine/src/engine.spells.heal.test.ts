import { describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";
import type {
  DiceRolledPayload,
  DraftEvent,
  HealingAppliedPayload,
  SpellCastPayload,
} from "./events/types";

const CAMPAIGN = "c:spells-heal";

const SCORES: AbilityScores = {
  str: 10,
  dex: 14,
  con: 14,
  int: 16,
  wis: 16,
  cha: 10,
};

/** A caster plus an ally target, both unplaced (touch/ranged range is then
 * unconstrained), with the ally optionally pre-damaged. */
async function setup(
  engine: Engine,
  opts: {
    casterLevel?: number;
    casterAbility?: keyof AbilityScores;
    allyMaxHp?: number;
    allyDamage?: number;
  } = {},
) {
  const {
    casterLevel = 5,
    casterAbility = "int",
    allyMaxHp = 30,
    allyDamage = 0,
  } = opts;
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Camp" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:mage",
      kind: "character",
      name: "Mage",
      abilityScores: SCORES,
      maxHp: 30,
      baseAc: 13,
      sceneId: "s:1",
      classes: [{ class: "Wizard", level: casterLevel }],
      spellcasting: { ability: casterAbility, casterLevel },
    },
  });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:ally",
      kind: "character",
      name: "Ally",
      abilityScores: SCORES,
      maxHp: allyMaxHp,
      baseAc: 13,
      sceneId: "s:1",
    },
  });
  if (allyDamage > 0) {
    await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:ally",
      damageType: "necrotic",
      source: { amount: allyDamage },
    });
  }
}

const healEvents = (events: DraftEvent[]) =>
  events.filter((e) => e.type === "HealingApplied") as {
    payload: HealingAppliedPayload;
  }[];

describe("Spells: Cure Wounds (touch heal, +spell mod, upcast)", () => {
  it("heals a wounded ally for 1d8 + the caster's spell modifier", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 20 }); // ally at 10/30
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const healed = healEvents(result.events);
    expect(healed).toHaveLength(1);
    // 1d8 (1–8) + int mod (+3) = 4–11, applied on top of 10 (no cap reached).
    expect(healed[0]!.payload.amount).toBeGreaterThanOrEqual(4);
    expect(healed[0]!.payload.amount).toBeLessThanOrEqual(11);
    expect(healed[0]!.payload.hpAfter).toBe(10 + healed[0]!.payload.amount);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[1]?.current).toBe(3);
  });

  it("does not overheal past max HP", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 1 }); // ally at 29/30
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(true);
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:ally"]?.hp.current).toBe(30);
  });

  it("upcasting adds a healing die per slot level above the first", async () => {
    const base = new Engine({ now: () => 3 });
    await setup(base, { allyMaxHp: 1000, allyDamage: 900 });
    const baseRes = await base.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(baseRes.accepted).toBe(true);
    if (!baseRes.accepted) return;
    const baseRolls = baseRes.events.filter(
      (e) => e.type === "DiceRolled",
    ) as { payload: DiceRolledPayload }[];
    expect(baseRolls.some((e) => e.payload.scope.endsWith(":upcast"))).toBe(false);

    const up = new Engine({ now: () => 3 });
    await setup(up, { allyMaxHp: 1000, allyDamage: 900 });
    const upRes = await up.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 3,
      targets: ["pc:ally"],
    });
    expect(upRes.accepted).toBe(true);
    if (!upRes.accepted) return;
    const upRolls = upRes.events.filter(
      (e) => e.type === "DiceRolled",
    ) as { payload: DiceRolledPayload }[];
    const upcast = upRolls.find((e) => e.payload.scope.endsWith(":upcast"));
    expect(upcast).toBeDefined();
    expect(upcast!.payload.rolls).toHaveLength(2); // +2d8 at 3rd level
  });

  it("revives a downed (but not dead) ally", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 30 }); // ally at 0, dying
    let ally = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(ally.alive).toBe(false);
    expect(ally.dead).toBe(false);

    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(true);
    ally = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(ally.alive).toBe(true);
    expect(ally.hp.current).toBeGreaterThan(0);
    expect(ally.deathSaves).toBeUndefined();
  });

  it("refuses a truly dead target for Cure Wounds", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 10 });
    // Down the ally, then three more hits while at 0 HP ⇒ 3 failures ⇒ dead.
    for (let i = 0; i < 4; i += 1) {
      await engine.execute(CAMPAIGN, {
        type: "apply_damage",
        target: "pc:ally",
        damageType: "necrotic",
        source: { amount: 20 },
      });
    }
    expect((await engine.getState(CAMPAIGN)).entities["pc:ally"]?.dead).toBe(true);

    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("INVALID_TARGET");
  });

  it("Revivify raises a dead creature to 1 HP", async () => {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:1", name: "Camp" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:cleric",
        kind: "character",
        name: "Cleric",
        abilityScores: SCORES,
        maxHp: 30,
        baseAc: 13,
        sceneId: "s:1",
        classes: [{ class: "Cleric", level: 5 }],
        spellcasting: {
          ability: "wis",
          casterLevel: 5,
          preparedSpellIds: ["revivify"],
        },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:ally",
        kind: "character",
        name: "Ally",
        abilityScores: SCORES,
        maxHp: 10,
        baseAc: 13,
        sceneId: "s:1",
      },
    });
    for (let i = 0; i < 4; i += 1) {
      await engine.execute(CAMPAIGN, {
        type: "apply_damage",
        target: "pc:ally",
        damageType: "necrotic",
        source: { amount: 20 },
      });
    }
    expect((await engine.getState(CAMPAIGN)).entities["pc:ally"]?.dead).toBe(
      true,
    );

    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "revivify",
      slotLevel: 3,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(true);
    const ally = (await engine.getState(CAMPAIGN)).entities["pc:ally"]!;
    expect(ally.dead).toBe(false);
    expect(ally.alive).toBe(true);
    expect(ally.hp.current).toBe(1);
    expect(ally.deathSaves).toBeUndefined();
  });
});

describe("Spells: Healing Word (bonus-action heal)", () => {
  it("consumes the bonus action in combat and rejects a second cast", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 20 });
    // Put the mage on the clock so the bonus-action economy exists.
    await engine.execute(CAMPAIGN, {
      type: "start_encounter",
      combatants: ["pc:mage"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:mage"]?.actionEconomy
        ?.bonusAction,
    ).toBe("available");

    const first = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "healing-word",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;
    const cast = first.events.find((e) => e.type === "SpellCast") as {
      payload: SpellCastPayload;
    };
    expect(cast.payload.bonusAction).toBe(true);
    expect(
      (await engine.getState(CAMPAIGN)).entities["pc:mage"]?.actionEconomy
        ?.bonusAction,
    ).toBe("used");

    const second = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "healing-word",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(second.accepted).toBe(false);
    if (!second.accepted) expect(second.reason.code).toBe("ACTION_UNAVAILABLE");
  });

  it("is unbudgeted out of combat (no action economy)", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 20 });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "healing-word",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(healEvents(result.events)).toHaveLength(1);
  });
});

describe("Spells: cantrip character-level scaling", () => {
  const baseDamageRoll = (events: DraftEvent[]) =>
    (
      events.filter((e) => e.type === "DiceRolled") as {
        payload: DiceRolledPayload;
      }[]
    ).find(
      (e) =>
        e.payload.scope.startsWith("spell-damage:") &&
        e.payload.scope.endsWith(":base"),
    );

  async function castFireBolt(casterLevel: number) {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:1", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:mage",
        kind: "character",
        name: "Mage",
        abilityScores: SCORES,
        maxHp: 30,
        baseAc: 13,
        sceneId: "s:1",
        classes: [{ class: "Wizard", level: casterLevel }],
        spellcasting: { ability: "int", casterLevel },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:dummy",
        kind: "monster",
        name: "Dummy",
        abilityScores: SCORES,
        maxHp: 200,
        baseAc: 1, // auto-hit (barring a natural 1)
        sceneId: "s:1",
      },
    });
    return engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:dummy"],
    });
  }

  it("Fire Bolt rolls 1d10 at level 1 and 2d10 at level 5", async () => {
    const lvl1 = await castFireBolt(1);
    expect(lvl1.accepted).toBe(true);
    if (!lvl1.accepted) return;
    expect(baseDamageRoll(lvl1.events)?.payload.rolls).toHaveLength(1);

    const lvl5 = await castFireBolt(5);
    expect(lvl5.accepted).toBe(true);
    if (!lvl5.accepted) return;
    expect(baseDamageRoll(lvl5.events)?.payload.rolls).toHaveLength(2);
  });

  it("Sacred Flame scales to 2d8 at level 5", async () => {
    const engine = new Engine({ now: () => 1 });
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: { id: "s:1", name: "Arena" },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:cleric",
        kind: "character",
        name: "Cleric",
        abilityScores: SCORES,
        maxHp: 30,
        baseAc: 13,
        sceneId: "s:1",
        classes: [{ class: "Cleric", level: 5 }],
        spellcasting: { ability: "wis", casterLevel: 5 },
      },
    });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:dummy",
        kind: "monster",
        name: "Dummy",
        abilityScores: SCORES,
        maxHp: 200,
        baseAc: 12,
        sceneId: "s:1",
      },
    });
    // Stun the target so it auto-fails the Dex save and takes the damage.
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "npc:dummy",
      condition: "stunned",
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:cleric",
      spellId: "sacred-flame",
      slotLevel: 0,
      targets: ["npc:dummy"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(baseDamageRoll(result.events)?.payload.rolls).toHaveLength(2);
  });
});

describe("Spells: heal + cantrip determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 7 });
    await setup(engine, { allyMaxHp: 30, allyDamage: 20 });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "cure-wounds",
      slotLevel: 1,
      targets: ["pc:ally"],
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "healing-word",
      slotLevel: 2,
      targets: ["pc:ally"],
    });
    return engine;
  };

  it("two identical streams converge", async () => {
    expect(await (await run()).getState(CAMPAIGN)).toEqual(
      await (await run()).getState(CAMPAIGN),
    );
  });

  it("rebuilding from the log reproduces the projection", async () => {
    const engine = await run();
    const live = await engine.getState(CAMPAIGN);
    const events = await engine.getEvents(CAMPAIGN);
    const { rebuild } = await import("./projections/world-state");
    expect(rebuild(CAMPAIGN, events)).toEqual(live);
  });
});
