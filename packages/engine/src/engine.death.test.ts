import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";
import type { DeathSaveRolledPayload } from "./events/types";

const ABILITIES: AbilityScores = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:death";

async function spawn(engine: Engine, id: string, maxHp: number) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id,
      kind: id.startsWith("pc") ? "character" : "monster",
      name: id,
      abilityScores: ABILITIES,
      maxHp,
      baseAc: 12,
      speed: 30,
      sceneId: "s:1",
    },
  });
}

async function setup(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: "s:1", name: "Arena" },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:1" });
}

async function damage(
  engine: Engine,
  target: string,
  amount: number,
  opts?: { critical?: boolean },
) {
  return engine.execute(CAMPAIGN, {
    type: "apply_damage",
    target,
    damageType: "necrotic",
    source: { amount },
    ...(opts?.critical ? { critical: true } : {}),
  });
}

async function state(engine: Engine, id: string) {
  return (await engine.getState(CAMPAIGN)).entities[id];
}

describe("Dying: dropping to 0 HP", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
    await spawn(engine, "pc:hero", 10);
  });

  it("downs (not kills) a creature reduced to 0 HP and starts death saves", async () => {
    await damage(engine, "pc:hero", 10);
    const hero = await state(engine, "pc:hero");
    expect(hero?.hp.current).toBe(0);
    expect(hero?.alive).toBe(false);
    expect(hero?.dead).toBe(false);
    expect(hero?.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("rejects a death save when the creature is not dying", async () => {
    const r = await engine.execute(CAMPAIGN, {
      type: "death_save",
      entity: "pc:hero",
    });
    expect(r.accepted).toBe(false);
    if (!r.accepted) expect(r.reason.code).toBe("NOT_DYING");
  });

  it("treats damage taken while at 0 HP as a death-save failure", async () => {
    await damage(engine, "pc:hero", 10); // down
    await damage(engine, "pc:hero", 1);
    let hero = await state(engine, "pc:hero");
    expect(hero?.deathSaves?.failures).toBe(1);
    expect(hero?.dead).toBe(false);

    await damage(engine, "pc:hero", 1);
    await damage(engine, "pc:hero", 1);
    hero = await state(engine, "pc:hero");
    expect(hero?.deathSaves?.failures).toBe(3);
    expect(hero?.dead).toBe(true);
  });

  it("counts a critical hit at 0 HP as two death-save failures", async () => {
    await damage(engine, "pc:hero", 10); // down
    await damage(engine, "pc:hero", 1, { critical: true });
    const hero = await state(engine, "pc:hero");
    expect(hero?.deathSaves?.failures).toBe(2);
    expect(hero?.dead).toBe(false);
  });

  it("instantly kills when overflow damage equals max HP", async () => {
    await spawn(engine, "pc:cleric", 12);
    await damage(engine, "pc:cleric", 6); // 6 / 12
    await damage(engine, "pc:cleric", 18); // 12 overflow >= 12 max
    const cleric = await state(engine, "pc:cleric");
    expect(cleric?.hp.current).toBe(0);
    expect(cleric?.dead).toBe(true);
    expect(cleric?.deathSaves).toBeUndefined();
  });

  it("downs without instant death when overflow is below max HP", async () => {
    await spawn(engine, "pc:tank", 22);
    await damage(engine, "pc:tank", 12); // 10 / 22
    await damage(engine, "pc:tank", 20); // 10 overflow < 22 max
    const tank = await state(engine, "pc:tank");
    expect(tank?.hp.current).toBe(0);
    expect(tank?.dead).toBe(false);
    expect(tank?.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("refuses to heal or roll for a truly dead creature", async () => {
    await damage(engine, "pc:hero", 25);
    await damage(engine, "pc:hero", 1);
    await damage(engine, "pc:hero", 1);
    await damage(engine, "pc:hero", 1); // 3 failures -> dead
    expect((await state(engine, "pc:hero"))?.dead).toBe(true);

    const heal = await engine.execute(CAMPAIGN, {
      type: "apply_healing",
      target: "pc:hero",
      source: { amount: 5 },
    });
    expect(heal.accepted).toBe(false);
    if (!heal.accepted) expect(heal.reason.code).toBe("TARGET_DEAD");

    const ds = await engine.execute(CAMPAIGN, {
      type: "death_save",
      entity: "pc:hero",
    });
    expect(ds.accepted).toBe(false);
    if (!ds.accepted) expect(ds.reason.code).toBe("ALREADY_DEAD");
  });

  it("resolves death saves to a terminal state (stable, dead, or revived)", async () => {
    await damage(engine, "pc:hero", 10); // down

    let terminal: "stable" | "dead" | "revived" | undefined;
    for (let i = 0; i < 12 && !terminal; i++) {
      const r = await engine.execute(CAMPAIGN, {
        type: "death_save",
        entity: "pc:hero",
      });
      if (!r.accepted) break;
      const hero = await state(engine, "pc:hero");
      if (hero?.dead) terminal = "dead";
      else if (hero?.stable) terminal = "stable";
      else if (hero && hero.hp.current > 0) terminal = "revived";
    }
    expect(terminal).toBeDefined();

    const hero = await state(engine, "pc:hero");
    if (terminal === "revived") {
      expect(hero?.hp.current).toBe(1);
      expect(hero?.alive).toBe(true);
      expect(hero?.deathSaves).toBeUndefined();
    } else if (terminal === "stable") {
      expect(hero?.deathSaves?.successes).toBe(3);
    } else {
      expect(hero?.dead).toBe(true);
    }
  });

  it("is deterministic across replay", async () => {
    await damage(engine, "pc:hero", 10);
    const firstSave = await engine.execute(CAMPAIGN, {
      type: "death_save",
      entity: "pc:hero",
    });
    const firstNatural = firstSave.accepted
      ? (
          firstSave.events.find((e) => e.type === "DeathSaveRolled")?.payload as
            | DeathSaveRolledPayload
            | undefined
        )?.natural
      : undefined;

    const replay = new Engine({ now: () => 1 });
    await setup(replay);
    await spawn(replay, "pc:hero", 10);
    await damage(replay, "pc:hero", 10);
    const secondSave = await replay.execute(CAMPAIGN, {
      type: "death_save",
      entity: "pc:hero",
    });
    const secondNatural = secondSave.accepted
      ? (
          secondSave.events.find((e) => e.type === "DeathSaveRolled")
            ?.payload as DeathSaveRolledPayload | undefined
        )?.natural
      : undefined;

    expect(secondNatural).toBe(firstNatural);
  });
});

describe("Rests", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
    await spawn(engine, "pc:hero", 30);
  });

  it("long rest restores HP to full and clears the dying state", async () => {
    await damage(engine, "pc:hero", 40); // down
    expect((await state(engine, "pc:hero"))?.hp.current).toBe(0);

    const r = await engine.execute(CAMPAIGN, {
      type: "long_rest",
      entity: "pc:hero",
    });
    expect(r.accepted).toBe(true);
    const hero = await state(engine, "pc:hero");
    expect(hero?.hp.current).toBe(30);
    expect(hero?.alive).toBe(true);
    expect(hero?.deathSaves).toBeUndefined();
  });

  it("long rest reduces exhaustion by one level", async () => {
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "exhaustion",
      level: 3,
    });
    await engine.execute(CAMPAIGN, { type: "long_rest", entity: "pc:hero" });
    let hero = await state(engine, "pc:hero");
    expect(
      hero?.conditions.find((c) => c.condition === "exhaustion")?.level,
    ).toBe(2);

    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:hero",
      condition: "exhaustion",
      level: 1,
    });
    await engine.execute(CAMPAIGN, { type: "long_rest", entity: "pc:hero" });
    hero = await state(engine, "pc:hero");
    expect(hero?.conditions.find((c) => c.condition === "exhaustion")).toBeUndefined();
  });

  it("short rest heals when Hit Dice are spent and is capped at max HP", async () => {
    await damage(engine, "pc:hero", 20); // 10 / 30
    const r = await engine.execute(CAMPAIGN, {
      type: "short_rest",
      entity: "pc:hero",
      hitDice: 2,
      dieSize: 10,
    });
    expect(r.accepted).toBe(true);
    const hero = await state(engine, "pc:hero");
    expect(hero?.hp.current).toBeGreaterThan(10);
    expect(hero?.hp.current).toBeLessThanOrEqual(30);
  });

  it("short rest with no Hit Dice is a no-op marker", async () => {
    await damage(engine, "pc:hero", 20);
    const r = await engine.execute(CAMPAIGN, {
      type: "short_rest",
      entity: "pc:hero",
    });
    expect(r.accepted).toBe(true);
    expect((await state(engine, "pc:hero"))?.hp.current).toBe(10);
  });
});

describe("Concentration", () => {
  let engine: Engine;
  beforeEach(async () => {
    engine = new Engine({ now: () => 1 });
    await setup(engine);
    await spawn(engine, "pc:mage", 100_000);
  });

  it("starts and ends concentration", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:mage",
      spell: "Hold Person",
    });
    expect((await state(engine, "pc:mage"))?.concentration).toEqual({
      spell: "Hold Person",
    });

    await engine.execute(CAMPAIGN, {
      type: "end_concentration",
      entity: "pc:mage",
    });
    expect((await state(engine, "pc:mage"))?.concentration).toBeUndefined();
  });

  it("recasting replaces the spell and reports a broken concentration", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:mage",
      spell: "Bless",
    });
    const r = await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:mage",
      spell: "Haste",
    });
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      const broken = r.events.find((e) => e.type === "ConcentrationBroken");
      expect(broken).toBeDefined();
    }
    expect((await state(engine, "pc:mage"))?.concentration).toEqual({
      spell: "Haste",
    });
  });

  it("breaks concentration when a big hit fails the CON save", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:mage",
      spell: "Hold Person",
    });
    // 100 damage -> DC max(10, 50) = 50; impossible to beat, so always breaks.
    const r = await damage(engine, "pc:mage", 100);
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      const broken = r.events.find((e) => e.type === "ConcentrationBroken");
      expect(broken).toBeDefined();
      const save = r.events.find((e) => e.type === "SaveRolled");
      expect(save).toBeDefined();
    }
    expect((await state(engine, "pc:mage"))?.concentration).toBeUndefined();
  });

  it("ends concentration without a save when dropped to 0 HP", async () => {
    await spawn(engine, "pc:frail", 10);
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:frail",
      spell: "Hold Person",
    });
    const r = await damage(engine, "pc:frail", 10); // down
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      // No CON save is rolled when concentration ends from being downed.
      expect(r.events.find((e) => e.type === "SaveRolled")).toBeUndefined();
    }
    const frail = await state(engine, "pc:frail");
    expect(frail?.hp.current).toBe(0);
    expect(frail?.concentration).toBeUndefined();
  });

  it("ends concentration when an incapacitating condition is applied", async () => {
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:mage",
      spell: "Hold Person",
    });
    await engine.execute(CAMPAIGN, {
      type: "apply_condition",
      target: "pc:mage",
      condition: "stunned",
    });
    expect((await state(engine, "pc:mage"))?.concentration).toBeUndefined();
  });
});
