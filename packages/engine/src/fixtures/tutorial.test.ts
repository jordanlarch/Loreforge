import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import {
  buildCompanionCommands,
  buildTutorialSeedCommands,
  classifyScene2Topic,
  nextTutorialScene,
  tutorialBeat,
  tutorialScene,
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_SCENE_HEARTH,
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

  it("advances to the Hearth scene by replaying its enter-commands", async () => {
    const engine = await seed();
    const next = nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(next?.id).toBe(TUTORIAL_SCENE_HEARTH);
    expect(next?.mentions).toContain("Lily Lampmaker");

    for (const command of next!.enter(TUTORIAL_FALLBACK_PARTY)) {
      await engine.execute(CAMPAIGN, command);
    }
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_HEARTH);
    expect(state.scenes[TUTORIAL_SCENE_HEARTH]?.map).toBeDefined();
    // The lead PC is carried into the tavern scene.
    expect(state.entities[TUTORIAL_FALLBACK_PARTY[0]!.id]?.sceneId).toBe(
      TUTORIAL_SCENE_HEARTH,
    );
  });

  it("routes free text to a dialogue topic and always reaches Lily's hook", () => {
    expect(classifyScene2Topic("I order a stew from the barman")).toBe(
      "barnaby",
    );
    // Anything else — including trying to leave — funnels to the quest-giver.
    expect(classifyScene2Topic("I turn and walk out the door")).toBe("lily");
    expect(classifyScene2Topic("I sit at the crying woman's table")).toBe(
      "lily",
    );
    expect(tutorialBeat("lily")?.offersHook).toBe(true);
    expect(tutorialBeat("barnaby")?.mentions).toContain("Lily Lampmaker");
    expect(tutorialBeat("nope")).toBeUndefined();
  });

  it("brings the companion in as a party-side character in the given scene", async () => {
    const engine = await seed();
    for (const command of buildCompanionCommands(TUTORIAL_SCENE_HOLLOWS_EDGE)) {
      await engine.execute(CAMPAIGN, command);
    }
    const brennar = (await engine.getState(CAMPAIGN)).entities[
      TUTORIAL_COMPANION.id
    ];
    expect(brennar?.kind).toBe("character");
    expect(brennar?.sceneId).toBe(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(brennar?.name).toBe("Old Brennar");
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
    expect(nextTutorialScene(TUTORIAL_SCENE_HEARTH)).toBeUndefined();
    expect(nextTutorialScene("scene:not-a-tutorial-scene")).toBeUndefined();
  });
});
