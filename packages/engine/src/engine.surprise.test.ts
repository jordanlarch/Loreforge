import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 10,
  cha: 10,
};

const CAMPAIGN = "c:surprise";

async function seedAmbush(engine: Engine) {
  await engine.execute(CAMPAIGN, {
    type: "create_scene",
    scene: {
      id: "s:ambush",
      name: "Ambush",
      map: { width: 12, height: 12, blockedCells: [] },
    },
  });
  await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:ambush" });
  for (const [id, position] of [
    ["pc:hero", { x: 2, y: 2 }],
    ["m:goblin", { x: 8, y: 2 }],
  ] as const) {
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id,
        kind: id.startsWith("pc") ? "character" : "monster",
        name: id,
        abilityScores: ABILITIES,
        maxHp: 100_000,
        baseAc: 12,
        speed: 30,
        sceneId: "s:ambush",
        position,
      },
    });
  }
  await engine.execute(CAMPAIGN, {
    type: "start_encounter",
    combatants: ["pc:hero", "m:goblin"],
    sides: { "pc:hero": "party", "m:goblin": "foes" },
  });
}

describe("Surprise (SRD-FID-17)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine();
  });

  it("marks surprised combatants and blocks actions on their first turn", async () => {
    await seedAmbush(engine);
    await engine.execute(CAMPAIGN, {
      type: "resolve_surprise",
      surprised: ["m:goblin"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });

    const state = await engine.getState(CAMPAIGN);
    expect(state.entities["m:goblin"]?.surprised).toBe(true);

    let active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
    while (active !== "m:goblin") {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      active = (await engine.getState(CAMPAIGN)).encounter!.order[
        (await engine.getState(CAMPAIGN)).encounter!.activeIndex
      ]!.entity;
    }

    const dash = await engine.execute(CAMPAIGN, {
      type: "dash",
      entity: "m:goblin",
    });
    expect(dash.accepted).toBe(false);
    if (!dash.accepted) {
      expect(dash.reason.code).toBe("ACTION_UNAVAILABLE");
    }
  });

  it("clears surprise after the surprised combatant's turn ends", async () => {
    await seedAmbush(engine);
    await engine.execute(CAMPAIGN, {
      type: "resolve_surprise",
      surprised: ["m:goblin"],
    });
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });

    let state = await engine.getState(CAMPAIGN);
    while (state.encounter!.order[state.encounter!.activeIndex]!.entity !== "m:goblin") {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      state = await engine.getState(CAMPAIGN);
    }

    await engine.execute(CAMPAIGN, { type: "end_turn" });
    state = await engine.getState(CAMPAIGN);
    expect(state.entities["m:goblin"]?.surprised).toBeUndefined();

    while (state.encounter!.order[state.encounter!.activeIndex]!.entity !== "m:goblin") {
      await engine.execute(CAMPAIGN, { type: "end_turn" });
      state = await engine.getState(CAMPAIGN);
    }

    const dash = await engine.execute(CAMPAIGN, {
      type: "dash",
      entity: "m:goblin",
    });
    expect(dash.accepted).toBe(true);
  });

  it("rejects resolving surprise after initiative is rolled", async () => {
    await seedAmbush(engine);
    await engine.execute(CAMPAIGN, { type: "roll_initiative" });
    const result = await engine.execute(CAMPAIGN, {
      type: "resolve_surprise",
      surprised: ["m:goblin"],
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason.code).toBe("INITIATIVE_ALREADY_ROLLED");
    }
  });

  it("rejects resolving surprise twice", async () => {
    await seedAmbush(engine);
    await engine.execute(CAMPAIGN, {
      type: "resolve_surprise",
      surprised: ["m:goblin"],
    });
    const result = await engine.execute(CAMPAIGN, {
      type: "resolve_surprise",
      surprised: [],
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason.code).toBe("SURPRISE_ALREADY_RESOLVED");
    }
  });
});
