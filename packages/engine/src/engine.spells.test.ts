import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import { spellAttackBonus, spellSaveDC } from "./content/spellcasting";
import type { AbilityScores } from "./entities/types";
import type {
  AttackResolvedPayload,
  DamageDealtPayload,
} from "./events/types";

const CAMPAIGN = "c:spells";

const SCORES: AbilityScores = {
  str: 10,
  dex: 14,
  con: 14,
  int: 16,
  wis: 16,
  cha: 10,
};

/** A level-5 full caster (int) plus a dummy target with a given AC/HP/position. */
async function setup(
  engine: Engine,
  opts: {
    targetAc?: number;
    targetHp?: number;
    casterPos?: { x: number; y: number };
    targetPos?: { x: number; y: number };
    walls?: { x: number; y: number }[];
    mapped?: boolean;
  } = {},
) {
  const {
    targetAc = 1,
    targetHp = 200,
    casterPos,
    targetPos,
    walls,
    mapped = false,
  } = opts;
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:1",
      name: "Arena",
      ...(mapped
        ? { map: { width: 40, height: 40, blockedCells: walls ?? [] } }
        : {}),
    },
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
      classes: [{ class: "Wizard", level: 5 }],
      spellcasting: { ability: "int" },
      ...(casterPos ? { position: casterPos } : {}),
    },
  });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "npc:dummy",
      kind: "monster",
      name: "Training Dummy",
      abilityScores: SCORES,
      maxHp: targetHp,
      baseAc: targetAc,
      sceneId: "s:1",
      ...(targetPos ? { position: targetPos } : {}),
    },
  });
}

describe("Spells: caster scaffolding & derivation", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
  });

  it("seeds full-caster slots from caster level", async () => {
    const mage = (await engine.getState(CAMPAIGN)).entities["pc:mage"]!;
    expect(mage.spellcasting?.ability).toBe("int");
    // Level-5 full caster: 4×1st, 3×2nd, 2×3rd; current === max.
    expect(mage.spellcasting?.slots).toEqual({
      1: { max: 4, current: 4 },
      2: { max: 3, current: 3 },
      3: { max: 2, current: 2 },
    });
  });

  it("derives save DC and spell attack from the explicit ability", async () => {
    const mage = (await engine.getState(CAMPAIGN)).entities["pc:mage"]!;
    // int 16 → +3; level 5 → proficiency +3. DC = 8+3+3, attack = 3+3.
    expect(spellSaveDC(mage)).toBe(14);
    expect(spellAttackBonus(mage)).toBe(6);
  });
});

describe("Spells: Magic Missile (auto-hit, multi-dart, upcast)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine, { targetHp: 200 });
  });

  it("fires three auto-hit darts at 1st level and spends one 1st-level slot", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "magic-missile",
      slotLevel: 1,
      targets: ["npc:dummy", "npc:dummy", "npc:dummy"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const dealt = result.events.filter(
      (e) => e.type === "DamageDealt",
    ) as { payload: DamageDealtPayload }[];
    expect(dealt).toHaveLength(3);
    // No attack roll on an auto-hit spell.
    expect(result.events.some((e) => e.type === "AttackResolved")).toBe(false);

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[1]?.current).toBe(3);

    // Each dart is 1d4+1 (2–5). Cumulative HP after = 200 − total dealt, and the
    // ledger keeps per-dart hpBefore/hpAfter consistent rather than all reading 200.
    const total = dealt.reduce((s, e) => s + e.payload.amount, 0);
    expect(state.entities["npc:dummy"]?.hp.current).toBe(200 - total);
    expect(dealt[0]!.payload.hpBefore).toBe(200);
    expect(dealt[2]!.payload.hpAfter).toBe(200 - total);
    for (const e of dealt) {
      expect(e.payload.amount).toBeGreaterThanOrEqual(2);
      expect(e.payload.amount).toBeLessThanOrEqual(5);
    }
  });

  it("adds one dart per slot level above 1st", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "magic-missile",
      slotLevel: 2,
      targets: ["npc:dummy", "npc:dummy", "npc:dummy", "npc:dummy"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.filter((e) => e.type === "DamageDealt")).toHaveLength(4);
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[2]?.current).toBe(2);
  });

  it("rejects when the dart count doesn't match the target list", async () => {
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "magic-missile",
      slotLevel: 1,
      targets: ["npc:dummy", "npc:dummy"],
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("INVALID_PAYLOAD");
  });
});

describe("Spells: Guiding Bolt (ranged spell attack, upcast)", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
  });

  it("hits a low-AC target and applies radiant damage", async () => {
    await setup(engine, { targetAc: 1, targetHp: 200 });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const attack = result.events.find(
      (e) => e.type === "AttackResolved",
    ) as { payload: AttackResolvedPayload } | undefined;
    expect(attack?.payload.hit).toBe(true);
    expect(attack?.payload.damageType).toBe("radiant");

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[1]?.current).toBe(3);
    expect(state.entities["npc:dummy"]!.hp.current).toBe(
      200 - attack!.payload.damage!,
    );
  });

  it("upcasting adds damage dice (more average damage over a fixed seed)", async () => {
    const avgDamage = async (slotLevel: number) => {
      let sum = 0;
      let hits = 0;
      for (let i = 0; i < 60; i += 1) {
        const e = new Engine({ now: () => i });
        await setup(e, { targetAc: 1, targetHp: 100_000 });
        const r = await e.execute(CAMPAIGN, {
          type: "cast_spell",
          caster: "pc:mage",
          spellId: "guiding-bolt",
          slotLevel,
          targets: ["npc:dummy"],
        });
        if (r.accepted) {
          const a = r.events.find((ev) => ev.type === "AttackResolved") as
            | { payload: AttackResolvedPayload }
            | undefined;
          if (a?.payload.hit) {
            sum += a.payload.damage!;
            hits += 1;
          }
        }
      }
      return sum / hits;
    };
    // 4d6 (base) vs 6d6 (cast at 3rd) — the upcast clearly raises average damage.
    expect(await avgDamage(3)).toBeGreaterThan(await avgDamage(1));
  });
});

describe("Spells: slot gating, range & line of sight", () => {
  it("rejects a cast with no available slot of that level", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine);
    // Drain both 3rd-level slots, then a third cast is rejected.
    for (let i = 0; i < 2; i += 1) {
      const r = await engine.execute(CAMPAIGN, {
        type: "cast_spell",
        caster: "pc:mage",
        spellId: "guiding-bolt",
        slotLevel: 3,
        targets: ["npc:dummy"],
      });
      expect(r.accepted).toBe(true);
    }
    const drained = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 3,
      targets: ["npc:dummy"],
    });
    expect(drained.accepted).toBe(false);
    if (!drained.accepted) expect(drained.reason.code).toBe("NO_SPELL_SLOT");
  });

  it("rejects a non-caster and an unknown spell", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "npc:brute",
        kind: "monster",
        name: "Brute",
        abilityScores: SCORES,
        maxHp: 20,
        baseAc: 12,
        sceneId: "s:1",
      },
    });
    const notCaster = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "npc:brute",
      spellId: "magic-missile",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(notCaster.accepted).toBe(false);
    if (!notCaster.accepted) expect(notCaster.reason.code).toBe("NOT_A_SPELLCASTER");

    const unknown = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "nope",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(unknown.accepted).toBe(false);
    if (!unknown.accepted) expect(unknown.reason.code).toBe("SPELL_NOT_FOUND");
  });

  it("rejects a spell not on the caster's prepared list (ENG-12)", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine);
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:prep",
        kind: "character",
        name: "Prepared-only",
        abilityScores: SCORES,
        maxHp: 30,
        baseAc: 13,
        sceneId: "s:1",
        classes: [{ class: "Wizard", level: 5 }],
        spellcasting: {
          ability: "int",
          casterLevel: 5,
          preparedSpellIds: ["fire-bolt"],
        },
        position: { x: 0, y: 0 },
      },
    });
    const ok = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:prep",
      spellId: "fire-bolt",
      slotLevel: 0,
      targets: ["npc:dummy"],
    });
    expect(ok.accepted).toBe(true);

    const blocked = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:prep",
      spellId: "magic-missile",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(blocked.accepted).toBe(false);
    if (!blocked.accepted) expect(blocked.reason.code).toBe("SPELL_NOT_PREPARED");
  });

  it("rejects a target beyond the spell's range", async () => {
    const engine = new Engine({ now: () => 1 });
    // Guiding Bolt range 120 ft = 24 cells; place the target 30 cells away.
    await setup(engine, {
      mapped: true,
      casterPos: { x: 0, y: 0 },
      targetPos: { x: 30, y: 0 },
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("OUT_OF_RANGE");
  });

  it("rejects a target with no line of sight", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      mapped: true,
      casterPos: { x: 0, y: 0 },
      targetPos: { x: 4, y: 0 },
      walls: [{ x: 2, y: 0 }],
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NO_LINE_OF_SIGHT");
  });
});

describe("Spells: long rest restores slots", () => {
  it("refills all expended slots to their maximum", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine);
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "magic-missile",
      slotLevel: 1,
      targets: ["npc:dummy", "npc:dummy", "npc:dummy"],
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 3,
      targets: ["npc:dummy"],
    });
    let mage = (await engine.getState(CAMPAIGN)).entities["pc:mage"]!;
    expect(mage.spellcasting?.slots[1]?.current).toBe(3);
    expect(mage.spellcasting?.slots[3]?.current).toBe(1);

    await engine.execute(CAMPAIGN, { type: "long_rest", entity: "pc:mage" });
    mage = (await engine.getState(CAMPAIGN)).entities["pc:mage"]!;
    expect(mage.spellcasting?.slots[1]?.current).toBe(4);
    expect(mage.spellcasting?.slots[3]?.current).toBe(2);
  });
});

describe("Spells: concentration bookkeeping", () => {
  it("spell damage triggers a concentration save on a concentrating target", async () => {
    const engine = new Engine({ now: () => 1 });
    // Dummy with modest HP so a Guiding Bolt hit deals damage without downing it
    // (a downed creature breaks concentration without a save).
    await setup(engine, { targetAc: 1, targetHp: 500 });
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "npc:dummy",
      spell: "Bless",
    });
    expect(
      (await engine.getState(CAMPAIGN)).entities["npc:dummy"]?.concentration,
    ).toEqual({ spell: "Bless" });

    const r = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 1,
      targets: ["npc:dummy"],
    });
    expect(r.accepted).toBe(true);
    if (!r.accepted) return;
    // The damage path raised a CON concentration save (DC = max(10, dmg/2)).
    const save = r.events.find(
      (e) => e.type === "SaveRolled",
    ) as { payload: { ability: string; dc: number } } | undefined;
    expect(save?.payload.ability).toBe("con");
    expect(save?.payload.dc).toBeGreaterThanOrEqual(10);
  });
});

describe("Spells: determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 7 });
    await setup(engine, { targetHp: 100_000 });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "magic-missile",
      slotLevel: 2,
      targets: ["npc:dummy", "npc:dummy", "npc:dummy", "npc:dummy"],
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "guiding-bolt",
      slotLevel: 3,
      targets: ["npc:dummy"],
    });
    return engine;
  };

  it("two identical cast streams converge", async () => {
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
