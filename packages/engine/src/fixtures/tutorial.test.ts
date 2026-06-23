import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import {
  buildTutorialSeedCommands,
  nextTutorialScene,
  tutorialScene,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_SCENE_HEARTH_STUB,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
} from "./tutorial";

const CAMPAIGN = "tut:fixture-test";

/** Replay the first-scene seed through a fresh engine. */
async function seed(): Promise<Engine> {
  const engine = new Engine();
  for (const command of buildTutorialSeedCommands(TUTORIAL_FALLBACK_PARTY)) {
    await engine.execute(CAMPAIGN, command);
  }
  return engine;
}

describe("tutorial script", () => {
  it("seeds the first scene as exploration: a mapped scene + the PC, no encounter", async () => {
    const engine = await seed();
    const state = await engine.getState(CAMPAIGN);

    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(TUTORIAL_FIRST_SCENE_ID).toBe(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(state.scenes[TUTORIAL_SCENE_HOLLOWS_EDGE]?.map).toBeDefined();
    // The lead PC is placed; no combat is running.
    const pc = state.entities[TUTORIAL_FALLBACK_PARTY[0]!.id];
    expect(pc?.kind).toBe("character");
    expect(pc?.position).toBeDefined();
    expect(state.encounter).toBeUndefined();
  });

  it("advances to the stub second scene by replaying its enter-commands", async () => {
    const engine = await seed();
    const next = nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(next?.id).toBe(TUTORIAL_SCENE_HEARTH_STUB);

    for (const command of next!.enter(TUTORIAL_FALLBACK_PARTY)) {
      await engine.execute(CAMPAIGN, command);
    }
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_HEARTH_STUB);
    expect(state.scenes[TUTORIAL_SCENE_HEARTH_STUB]?.map).toBeDefined();
  });

  it("offers a scene-1 ability check the engine resolves to a verdict", async () => {
    const engine = await seed();
    const scene = tutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(scene?.check?.skill).toBe("Survival");

    const result = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: TUTORIAL_FALLBACK_PARTY[0]!.id,
      ability: scene!.check!.ability,
      skill: scene!.check!.skill,
      dc: scene!.check!.dc,
      proficient: scene!.check!.proficient,
    });

    expect(result.accepted).toBe(true);
    const summary = result.accepted ? result.summary : undefined;
    expect(typeof (summary as { total?: number }).total).toBe("number");
    expect(typeof (summary as { success?: boolean }).success).toBe("boolean");
  });

  it("returns no next scene at the end of the script", () => {
    expect(nextTutorialScene(TUTORIAL_SCENE_HEARTH_STUB)).toBeUndefined();
    expect(nextTutorialScene("scene:not-a-tutorial-scene")).toBeUndefined();
  });
});
