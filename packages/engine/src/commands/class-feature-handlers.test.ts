import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import { featureResourceKey } from "../entities/feature-resources";

const CAMPAIGN = "fid21-product-wiring";

describe("use_class_feature command", () => {
  it("spends Rage and applies self effects on the active turn", async () => {
    const engine = new Engine({ now: () => 1_000 });
    const barbId = "pc:barb";
    const foeId = "npc:foe";

    for (const cmd of [
      {
        type: "create_scene" as const,
        scene: {
          id: "arena",
          name: "Arena",
          map: { width: 10, height: 10, blockedCells: [] },
        },
      },
      { type: "change_scene" as const, sceneId: "arena" },
      {
        type: "create_entity" as const,
        entity: {
          id: barbId,
          kind: "character" as const,
          name: "Thorgar",
          abilityScores: { str: 16, dex: 14, con: 14, int: 8, wis: 10, cha: 8 },
          maxHp: 30,
          baseAc: 14,
          speed: 30,
          classes: [{ class: "Barbarian", level: 3 }],
          sceneId: "arena",
          position: { x: 1, y: 1 },
        },
      },
      {
        type: "create_entity" as const,
        entity: {
          id: foeId,
          kind: "monster" as const,
          name: "Goblin",
          abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          maxHp: 7,
          baseAc: 13,
          speed: 30,
          sceneId: "arena",
          position: { x: 3, y: 1 },
        },
      },
      {
        type: "start_encounter" as const,
        sceneId: "arena",
        combatants: [barbId, foeId],
        sides: { [barbId]: "party", [foeId]: "foes" },
      },
      { type: "roll_initiative" as const, bonuses: { [barbId]: 10, [foeId]: 0 } },
    ]) {
      await engine.execute(CAMPAIGN, cmd);
    }

    const rageKey = featureResourceKey("Barbarian", 1, "rage");
    const result = await engine.execute(CAMPAIGN, {
      type: "use_class_feature",
      entity: barbId,
      featureKey: rageKey,
    });

    expect(result.accepted).toBe(true);
    const state = await engine.getState(CAMPAIGN);
    const barb = state.entities[barbId];
    expect(barb?.effects?.some((e) => e.name === "Rage")).toBe(true);
    expect(barb?.resourceUses?.[rageKey]?.some(Boolean)).toBe(true);
  });
});
