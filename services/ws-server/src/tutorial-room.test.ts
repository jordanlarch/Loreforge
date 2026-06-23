import { describe, expect, it } from "vitest";

import {
  InMemoryEventStore,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_SCENE_HEARTH_STUB,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  type PartyMember,
} from "@app/engine";

import { TutorialRoom } from "./tutorial-room.js";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000bb";

const MIRA: PartyMember = {
  id: "char:mira-row",
  name: "Mira Thornwood",
  abilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 },
  maxHp: 27,
  baseAc: 14,
  speed: 30,
  classes: [{ class: "Ranger", level: 3 }],
  spellcasting: { ability: "wis", casterLevel: 3 },
};

describe("TutorialRoom", () => {
  it("seeds the first scene as exploration (map + PC, no encounter)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    const state = await room.getState();

    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_HOLLOWS_EDGE);
    expect(state.encounter).toBeUndefined();
    expect(state.entities[MIRA.id]?.name).toBe("Mira Thornwood");
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(0);
  });

  it("does not re-seed a log that already has events", async () => {
    const store = new InMemoryEventStore();
    await new TutorialRoom(CAMPAIGN, store, async () => [MIRA]).getState();
    const afterSeed = await store.lastSequence(CAMPAIGN);

    await new TutorialRoom(CAMPAIGN, store, async () => [MIRA]).getState();

    expect(await store.lastSequence(CAMPAIGN)).toBe(afterSeed);
  });

  it("falls back to the fixture PC when no roster is loaded", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => []);

    const state = await room.getState();

    expect(state.entities[TUTORIAL_FALLBACK_PARTY[0]!.id]?.kind).toBe(
      "character",
    );
  });

  it("advances to the stub second scene and grows the log", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    const baseline = await (async () => {
      await room.getState();
      return store.lastSequence(CAMPAIGN);
    })();

    const result = await room.advance();

    expect(result?.sceneId).toBe(TUTORIAL_SCENE_HEARTH_STUB);
    expect(result?.narration.length).toBeGreaterThan(0);
    expect((await room.getState()).currentSceneId).toBe(
      TUTORIAL_SCENE_HEARTH_STUB,
    );
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(baseline);
  });

  it("returns null when advancing past the end of the script", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → stub scene 2 (the last entry)

    expect(await room.advance()).toBeNull();
  });

  it("resolves the scene's offered check through the engine", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    const result = await room.runScriptedCheck();

    expect(result?.accepted).toBe(true);
    expect(result?.actorName).toBe("Mira Thornwood");
    expect(result?.check.skill).toBe("Survival");
    expect(typeof (result?.summary as { total?: number }).total).toBe("number");
  });

  it("offers no check once advanced to a scene without one", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // stub scene 2 has no check

    expect(await room.runScriptedCheck()).toBeNull();
  });
});
