import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";
import type { SaveRolledPayload } from "./events/types";

const SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 16,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:save-prof";

async function seedFighter(
  engine: Engine,
  saveProficiencies: ("str" | "con")[],
) {
  await engine.execute(CAMPAIGN, {
    type: "create_entity",
    entity: {
      id: "pc:fighter",
      kind: "character",
      name: "Test Fighter",
      abilityScores: SCORES,
      maxHp: 40,
      baseAc: 16,
      speed: 30,
      classes: [{ class: "Fighter", level: 5 }],
      saveProficiencies,
    },
  });
}

describe("save proficiency (SRD-FID-16)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine();
  });

  it("adds proficiency bonus on a proficient class save", async () => {
    await seedFighter(engine, ["str", "con"]);
    const result = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:fighter",
      ability: "con",
      dc: 10,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const save = result.events.find((e) => e.type === "SaveRolled");
    expect(save).toBeDefined();
    const payload = save!.payload as SaveRolledPayload;
    expect(payload.proficient).toBe(true);
    expect(payload.total).toBe(
      payload.natural! +
        3 +
        (await engine.getState(CAMPAIGN)).entities["pc:fighter"]!
          .proficiencyBonus,
    );
  });

  it("does not add proficiency bonus on a non-proficient save", async () => {
    await seedFighter(engine, ["str", "con"]);
    const result = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:fighter",
      ability: "wis",
      dc: 10,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const payload = result.events.find((e) => e.type === "SaveRolled")!
      .payload as SaveRolledPayload;
    expect(payload.proficient).toBe(false);
    expect(payload.total).toBe(payload.natural! + 0);
  });

  it("honours command proficient override when entity lacks the save", async () => {
    await seedFighter(engine, []);
    const result = await engine.execute(CAMPAIGN, {
      type: "saving_throw",
      entity: "pc:fighter",
      ability: "con",
      dc: 10,
      proficient: true,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const payload = result.events.find((e) => e.type === "SaveRolled")!
      .payload as SaveRolledPayload;
    expect(payload.proficient).toBe(true);
    const pb = (await engine.getState(CAMPAIGN)).entities["pc:fighter"]!
      .proficiencyBonus;
    expect(payload.total).toBe(payload.natural! + 3 + pb);
  });

  it("includes proficiency on concentration CON saves when proficient", async () => {
    await seedFighter(engine, ["str", "con"]);
    await engine.execute(CAMPAIGN, {
      type: "start_concentration",
      entity: "pc:fighter",
      spell: "Bless",
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "apply_damage",
      target: "pc:fighter",
      source: { amount: 12 },
      damageType: "slashing",
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    const save = result.events.find((e) => e.type === "SaveRolled");
    expect(save).toBeDefined();
    const payload = save!.payload as SaveRolledPayload;
    expect(payload.ability).toBe("con");
    expect(payload.proficient).toBe(true);
    const pb = (await engine.getState(CAMPAIGN)).entities["pc:fighter"]!
      .proficiencyBonus;
    expect(payload.total).toBe(payload.natural! + 3 + pb);
  });
});
