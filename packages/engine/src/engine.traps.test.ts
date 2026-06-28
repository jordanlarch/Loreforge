import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "./engine";
import type { AbilityScores } from "./entities/types";

const ABILITIES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 14,
  cha: 10,
};

const CAMPAIGN = "c:traps";

describe("Gameplay Toolbox traps (GRILL-LIVE-TOOLBOX)", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ now: () => 0 });
  });

  async function setupSceneWithTrap(disabled = false) {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:trap-room",
        name: "Trapped hall",
        sceneKind: "dungeon",
        map: { width: 5, height: 5, blockedCells: [] },
        traps: [
          {
            instanceId: "trap:needle-1",
            trapSlug: "srd-2024_poison-needle",
            position: { x: 2, y: 0 },
            detected: false,
            disabled,
            triggered: false,
          },
        ],
      },
    });
    await engine.execute(CAMPAIGN, { type: "change_scene", sceneId: "s:trap-room" });
    await engine.execute(CAMPAIGN, {
      type: "create_entity",
      entity: {
        id: "pc:rogue",
        kind: "character",
        name: "Rogue",
        abilityScores: ABILITIES,
        maxHp: 20,
        baseAc: 14,
        speed: 30,
        sceneId: "s:trap-room",
        position: { x: 0, y: 0 },
      },
    });
  }

  it("detect_trap emits TrapDetected and updates scene on success", async () => {
    await setupSceneWithTrap();
    const result = await engine.execute(CAMPAIGN, {
      type: "detect_trap",
      entity: "pc:rogue",
      sceneId: "s:trap-room",
      trapInstanceId: "trap:needle-1",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "TrapDetected")).toBe(true);
    const detected = result.events.find((e) => e.type === "TrapDetected");
    const state = await engine.getState(CAMPAIGN);
    const trap = state.scenes["s:trap-room"]?.traps?.[0];
    if (detected && (detected.payload as { success: boolean }).success) {
      expect(trap?.detected).toBe(true);
    }
  });

  it("move_entity onto trapped cell auto-triggers trap events", async () => {
    await setupSceneWithTrap();
    const result = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:rogue",
      to: { x: 2, y: 0 },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "TrapTriggered")).toBe(true);
    expect(result.events.some((e) => e.type === "SaveRolled")).toBe(true);

    const state = await engine.getState(CAMPAIGN);
    expect(state.scenes["s:trap-room"]?.traps?.[0]?.triggered).toBe(true);
  });

  it("disabled trap does not auto-trigger on entry", async () => {
    await setupSceneWithTrap(true);
    const result = await engine.execute(CAMPAIGN, {
      type: "move_entity",
      entity: "pc:rogue",
      to: { x: 2, y: 0 },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.events.some((e) => e.type === "TrapTriggered")).toBe(false);
  });

  it("create_scene strips traps from settlement scenes (GRILL-LIVE-TOOLBOX Q2b)", async () => {
    await engine.execute(CAMPAIGN, {
      type: "create_scene",
      scene: {
        id: "s:town",
        name: "Town square",
        sceneKind: "settlement",
        map: { width: 5, height: 5, blockedCells: [] },
        traps: [
          {
            instanceId: "trap:bad",
            trapSlug: "srd-2024_poison-needle",
            position: { x: 1, y: 1 },
            detected: false,
            disabled: false,
            triggered: false,
          },
        ],
      },
    });

    const state = await engine.getState(CAMPAIGN);
    expect(state.scenes["s:town"]?.traps).toBeUndefined();
  });
});
