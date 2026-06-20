import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores, GridPosition } from "./entities/types";
import type {
  DamageDealtPayload,
  DiceRolledPayload,
  DraftEvent,
  SaveRolledPayload,
  SpellCastPayload,
} from "./events/types";

const CAMPAIGN = "c:spells-aoe";

const SCORES: AbilityScores = {
  str: 10,
  dex: 14,
  con: 14,
  int: 16,
  wis: 16,
  cha: 10,
};

type DummySpec = {
  id: string;
  pos: GridPosition;
  hp?: number;
  dex?: number;
  /** Auto-fail Dex saves (and force full AoE damage). */
  stunned?: boolean;
};

/**
 * A mapped arena with a level-5 int caster at `casterPos` and a set of
 * positioned dummies. Returns once everything is placed (and stunned where
 * requested), so a single cast can be resolved against the map.
 */
async function setup(
  engine: Engine,
  opts: {
    casterPos?: GridPosition;
    dummies?: DummySpec[];
    walls?: GridPosition[];
    casterAbility?: keyof AbilityScores;
    casterScores?: AbilityScores;
    casterLevel?: number;
  } = {},
) {
  const {
    casterPos = { x: 0, y: 0 },
    dummies = [],
    walls = [],
    casterAbility = "int",
    casterScores = SCORES,
    casterLevel = 5,
  } = opts;
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:1",
      name: "Arena",
      map: { width: 60, height: 60, blockedCells: walls },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:mage",
      kind: "character",
      name: "Mage",
      abilityScores: casterScores,
      maxHp: 30,
      baseAc: 13,
      sceneId: "s:1",
      classes: [{ class: "Wizard", level: casterLevel }],
      spellcasting: { ability: casterAbility, casterLevel },
      position: casterPos,
    },
  });
  for (const d of dummies) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: d.id,
        kind: "monster",
        name: d.id,
        abilityScores: { ...SCORES, dex: d.dex ?? 14 },
        maxHp: d.hp ?? 200,
        baseAc: 12,
        sceneId: "s:1",
        position: d.pos,
      },
    });
    if (d.stunned) {
      await engine.execute(CAMPAIGN, {
        type: "apply_condition",
        target: d.id,
        condition: "stunned",
      });
    }
  }
}

const damageEvents = (events: DraftEvent[]) =>
  events.filter((e) => e.type === "DamageDealt") as {
    payload: DamageDealtPayload;
  }[];
const saveEvents = (events: DraftEvent[]) =>
  events.filter((e) => e.type === "SaveRolled") as {
    payload: SaveRolledPayload;
  }[];

describe("Spells: Fireball (sphere AoE, Dex save-for-half, upcast)", () => {
  it("catches every creature in the 20-ft sphere; failed saves take full damage", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      casterPos: { x: 0, y: 0 },
      dummies: [
        { id: "npc:a", pos: { x: 10, y: 10 }, stunned: true },
        { id: "npc:b", pos: { x: 12, y: 12 }, stunned: true }, // 10 ft from center
        { id: "npc:far", pos: { x: 16, y: 10 }, stunned: true }, // 30 ft — outside
      ],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    // Only the two in-radius dummies are caught (the far one is excluded).
    const cast = result.events.find((e) => e.type === "SpellCast") as {
      payload: SpellCastPayload;
    };
    expect(new Set(cast.payload.targets)).toEqual(new Set(["npc:a", "npc:b"]));

    // Stunned ⇒ auto-fail ⇒ full damage, and a single shared 8d6 roll means
    // both caught creatures take the identical amount.
    const dealt = damageEvents(result.events);
    expect(dealt).toHaveLength(2);
    expect(dealt[0]!.payload.amount).toBe(dealt[1]!.payload.amount);
    expect(result.summary.rolledDamage).toBe(dealt[0]!.payload.amount);
    expect(result.summary.failures).toBe(2);

    const state = await engine.getState(CAMPAIGN);
    // 3rd-level slot consumed; far dummy untouched.
    expect(state.entities["pc:mage"]?.spellcasting?.slots[3]?.current).toBe(1);
    expect(state.entities["npc:far"]?.hp.current).toBe(200);
  });

  it("applies half damage (rounded down) to creatures that succeed on the save", async () => {
    // Property over the seed: whatever each creature rolls, a success takes
    // floor(full/2) and a failure takes full.
    const engine = new Engine({ now: () => 4 });
    await setup(engine, {
      casterPos: { x: 0, y: 0 },
      dummies: [
        { id: "npc:a", pos: { x: 10, y: 10 } },
        { id: "npc:b", pos: { x: 11, y: 10 } },
        { id: "npc:c", pos: { x: 10, y: 11 } },
      ],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const full = result.summary.rolledDamage as number;
    const saves = saveEvents(result.events);
    expect(saves).toHaveLength(3);
    for (const save of saves) {
      const dealt = damageEvents(result.events).find(
        (e) => e.payload.target === save.payload.entity,
      );
      if (save.payload.success) {
        const expected = Math.floor(full / 2);
        if (expected === 0) {
          expect(dealt).toBeUndefined();
        } else {
          expect(dealt?.payload.amount).toBe(expected);
        }
      } else {
        expect(dealt?.payload.amount).toBe(full);
      }
    }
  });

  it("upcasting at 5th level adds 2d6 to the shared roll", async () => {
    const base = new Engine({ now: () => 9 });
    await setup(base, {
      casterLevel: 9,
      dummies: [{ id: "npc:a", pos: { x: 10, y: 10 }, stunned: true }],
    });
    const baseRes = await base.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    expect(baseRes.accepted).toBe(true);
    if (!baseRes.accepted) return;
    // Base cast rolls 8d6 only — no upcast dice draw.
    const baseRolls = baseRes.events.filter(
      (e) => e.type === "DiceRolled",
    ) as { payload: DiceRolledPayload }[];
    expect(baseRolls.some((e) => e.payload.scope.endsWith(":upcast"))).toBe(false);
    expect(baseRes.summary.rolledDamage as number).toBeGreaterThanOrEqual(8);
    expect(baseRes.summary.rolledDamage as number).toBeLessThanOrEqual(48);

    const up = new Engine({ now: () => 9 });
    await setup(up, {
      casterLevel: 9,
      dummies: [{ id: "npc:a", pos: { x: 10, y: 10 }, stunned: true }],
    });
    const upRes = await up.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 5,
      origin: { x: 10, y: 10 },
    });
    expect(upRes.accepted).toBe(true);
    if (!upRes.accepted) return;
    const upRolls = upRes.events.filter(
      (e) => e.type === "DiceRolled",
    ) as { payload: DiceRolledPayload }[];
    const upcast = upRolls.find((e) => e.payload.scope.endsWith(":upcast"));
    expect(upcast).toBeDefined();
    // Two extra slot levels ⇒ 2d6 added (range 2–12).
    expect(upcast!.payload.rolls).toHaveLength(2);
    expect(upRes.summary.rolledDamage as number).toBeGreaterThanOrEqual(10);
    expect(upRes.summary.rolledDamage as number).toBeLessThanOrEqual(60);
  });

  it("a wall shields a creature behind it from the blast", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      casterPos: { x: 0, y: 0 },
      walls: [{ x: 12, y: 10 }],
      dummies: [
        { id: "npc:open", pos: { x: 11, y: 10 }, stunned: true },
        { id: "npc:shielded", pos: { x: 13, y: 10 }, stunned: true },
      ],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const cast = result.events.find((e) => e.type === "SpellCast") as {
      payload: SpellCastPayload;
    };
    expect(cast.payload.targets).toEqual(["npc:open"]);
  });

  it("rejects an origin beyond range or with no line of sight", async () => {
    const oob = new Engine({ now: () => 1 });
    await setup(oob, { casterPos: { x: 0, y: 0 } });
    const farRes = await oob.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 40, y: 0 }, // 200 ft > 150 ft range
    });
    expect(farRes.accepted).toBe(false);
    if (!farRes.accepted) expect(farRes.reason.code).toBe("OUT_OF_RANGE");

    const los = new Engine({ now: () => 1 });
    await setup(los, { casterPos: { x: 0, y: 0 }, walls: [{ x: 5, y: 5 }] });
    const losRes = await los.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    expect(losRes.accepted).toBe(false);
    if (!losRes.accepted) expect(losRes.reason.code).toBe("NO_LINE_OF_SIGHT");
  });

  it("rejects an area cast with no origin", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, { dummies: [{ id: "npc:a", pos: { x: 10, y: 10 } }] });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.code).toBe("INVALID_PAYLOAD");
    // No slot was spent on a rejected cast.
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[3]?.current).toBe(2);
  });
});

describe("Spells: Burning Hands (15-ft cone from the caster)", () => {
  it("catches creatures in the cone aimed east but not off-axis ones", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      casterPos: { x: 0, y: 0 },
      dummies: [
        { id: "npc:ahead", pos: { x: 2, y: 0 }, stunned: true }, // 10 ft straight
        { id: "npc:edge", pos: { x: 3, y: 0 }, stunned: true }, // 15 ft, in line
        { id: "npc:offaxis", pos: { x: 1, y: 1 }, stunned: true }, // off-axis
        { id: "npc:behind", pos: { x: -2, y: 0 }, stunned: true }, // behind apex
      ],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "burning-hands",
      slotLevel: 1,
      origin: { x: 1, y: 0 }, // aim east
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const cast = result.events.find((e) => e.type === "SpellCast") as {
      payload: SpellCastPayload;
    };
    expect(new Set(cast.payload.targets)).toEqual(
      new Set(["npc:ahead", "npc:edge"]),
    );
    // 1st-level slot spent.
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[1]?.current).toBe(3);
  });
});

describe("Spells: Sacred Flame (single-target Dex save cantrip)", () => {
  it("deals radiant damage on a failed save and spends no slot", async () => {
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      dummies: [{ id: "npc:a", pos: { x: 5, y: 0 }, stunned: true }],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "sacred-flame",
      slotLevel: 0,
      targets: ["npc:a"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const dealt = damageEvents(result.events);
    expect(dealt).toHaveLength(1);
    expect(dealt[0]!.payload.damageType).toBe("radiant");
    // The level-5 caster scales Sacred Flame to 2d8 (2–16).
    expect(dealt[0]!.payload.amount).toBeGreaterThanOrEqual(2);
    expect(dealt[0]!.payload.amount).toBeLessThanOrEqual(16);
    // Cantrip — slot pools untouched.
    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["pc:mage"]?.spellcasting?.slots[1]?.current).toBe(4);
  });

  it("deals no damage when the target succeeds on the save (no_effect)", async () => {
    // A low-DC caster (DC 10) against a dex-30 (+10) target always succeeds.
    const engine = new Engine({ now: () => 1 });
    await setup(engine, {
      casterAbility: "wis",
      casterScores: { ...SCORES, wis: 10 },
      casterLevel: 1,
      dummies: [{ id: "npc:nimble", pos: { x: 5, y: 0 }, dex: 30 }],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "sacred-flame",
      slotLevel: 0,
      targets: ["npc:nimble"],
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const save = saveEvents(result.events)[0]!;
    expect(save.payload.success).toBe(true);
    // no_effect on success ⇒ no damage event.
    expect(damageEvents(result.events)).toHaveLength(0);
  });
});

describe("Spells: AoE determinism & replay", () => {
  const run = async () => {
    const engine = new Engine({ now: () => 7 });
    await setup(engine, {
      casterPos: { x: 0, y: 0 },
      dummies: [
        { id: "npc:a", pos: { x: 10, y: 10 }, hp: 100_000 },
        { id: "npc:b", pos: { x: 11, y: 11 }, hp: 100_000 },
      ],
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "fireball",
      slotLevel: 3,
      origin: { x: 10, y: 10 },
    });
    await engine.execute(CAMPAIGN, {
      type: "cast_spell",
      caster: "pc:mage",
      spellId: "sacred-flame",
      slotLevel: 0,
      targets: ["npc:a"],
    });
    return engine;
  };

  it("two identical AoE cast streams converge", async () => {
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
