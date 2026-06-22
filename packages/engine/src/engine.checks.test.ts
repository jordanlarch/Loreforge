import { describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { CheckRolledPayload } from "./events/types";

const CAMPAIGN = "checks-test";
const SCENE = "s:1";

/** A wizard-ish PC: INT 18 (+4), level 5 (proficiency +3). */
async function setup() {
  const engine = new Engine({ now: () => 0 });
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: { id: SCENE, name: "Library" },
  });
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:sage",
      kind: "character",
      name: "Sage",
      abilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 12, cha: 8 },
      maxHp: 30,
      baseAc: 12,
      sceneId: SCENE,
      classes: [{ class: "Wizard", level: 5 }],
    },
  });
  return engine;
}

function lastCheck(events: { type: string; payload: unknown }[]): CheckRolledPayload {
  const event = [...events].reverse().find((e) => e.type === "CheckRolled");
  if (!event) throw new Error("no CheckRolled event");
  return event.payload as CheckRolledPayload;
}

describe("ability_check", () => {
  it("rolls d20 + ability modifier and decides success against a DC", async () => {
    const engine = await setup();
    const res = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:sage",
      ability: "int",
      skill: "Arcana",
      dc: 10,
    });

    expect(res.accepted).toBe(true);
    const events = await engine.getEvents(CAMPAIGN);
    const check = lastCheck(events);
    expect(check.ability).toBe("int");
    expect(check.skill).toBe("Arcana");
    // total = natural + INT mod (+4); no proficiency since not flagged.
    expect(check.total).toBe(check.natural + 4);
    expect(check.proficient).toBe(false);
    expect(check.success).toBe(check.total >= 10);
  });

  it("adds the proficiency bonus when proficient", async () => {
    const engine = await setup();
    await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:sage",
      ability: "int",
      skill: "Arcana",
      dc: 5,
      proficient: true,
    });
    const check = lastCheck(await engine.getEvents(CAMPAIGN));
    // total = natural + INT mod (+4) + proficiency (+3 at level 5).
    expect(check.total).toBe(check.natural + 4 + 3);
    expect(check.proficient).toBe(true);
  });

  it("supports an uncontested roll with no DC (success omitted)", async () => {
    const engine = await setup();
    const res = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:sage",
      ability: "wis",
    });
    expect(res.accepted).toBe(true);
    const check = lastCheck(await engine.getEvents(CAMPAIGN));
    expect(check.success).toBeUndefined();
    expect(check.dc).toBeUndefined();
    // WIS 12 → +1.
    expect(check.total).toBe(check.natural + 1);
  });

  it("rejects a check for a nonexistent entity", async () => {
    const engine = await setup();
    const res = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: "pc:ghost",
      ability: "int",
      dc: 10,
    });
    expect(res.accepted).toBe(false);
  });

  it("is deterministic on replay (same seed → same roll)", async () => {
    const a = lastCheck(
      await (async () => {
        const e = await setup();
        await e.execute(CAMPAIGN, {
          type: "ability_check",
          entity: "pc:sage",
          ability: "int",
          dc: 10,
        });
        return e.getEvents(CAMPAIGN);
      })(),
    );
    const b = lastCheck(
      await (async () => {
        const e = await setup();
        await e.execute(CAMPAIGN, {
          type: "ability_check",
          entity: "pc:sage",
          ability: "int",
          dc: 10,
        });
        return e.getEvents(CAMPAIGN);
      })(),
    );
    expect(a.natural).toBe(b.natural);
    expect(a.total).toBe(b.total);
  });
});
