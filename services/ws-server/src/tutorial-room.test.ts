import { describe, expect, it } from "vitest";

import {
  InMemoryEventStore,
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_SCENE_CROOKED_LANE,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE_SPIRE_LOWER,
  TUTORIAL_SCENE_SPIRE_STAIR,
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

  it("advances to the Hearth scene and grows the log", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    const baseline = await (async () => {
      await room.getState();
      return store.lastSequence(CAMPAIGN);
    })();

    const result = await room.advance();

    expect(result?.sceneId).toBe(TUTORIAL_SCENE_HEARTH);
    expect(result?.narration.length).toBeGreaterThan(0);
    expect(result?.mentions).toContain("Lily Lampmaker");
    expect((await room.getState()).currentSceneId).toBe(TUTORIAL_SCENE_HEARTH);
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(baseline);
  });

  it("advances on to the Crooked Lane shop scene", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth

    const result = await room.advance(); // → Crooked Lane
    expect(result?.sceneId).toBe(TUTORIAL_SCENE_CROOKED_LANE);
    expect(result?.mentions).toContain("Tinker's Mercy");
    expect((await room.getState()).currentSceneId).toBe(
      TUTORIAL_SCENE_CROOKED_LANE,
    );
  });

  it("arms an encounter on the combat handoff (Scene 4 → the Stair)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth
    await room.advance(); // → Crooked Lane
    await room.advance(); // → Spire Lower Hall
    const result = await room.advance(); // → the Stair (combat)

    expect(result?.sceneId).toBe(TUTORIAL_SCENE_SPIRE_STAIR);
    expect(result?.combat).toBe(true);

    const state = await room.getState();
    expect(state.encounter).toBeDefined();
    // The PC and both shadow foes are in initiative.
    const ids = state.encounter!.order.map((o) => o.entity);
    expect(ids).toContain(MIRA.id);
    expect(ids.filter((id) => id.startsWith("npc:tut-shadow"))).toHaveLength(2);
  });

  it("returns null when advancing past the end of the script", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth
    await room.advance(); // → Crooked Lane
    await room.advance(); // → Spire Lower Hall
    await room.advance(); // → the Stair (the last entry)

    expect(await room.advance()).toBeNull();
  });

  it("returns canned Scene 2 dialogue beats for a topic (soft rail)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    expect(room.say("lily")?.offersHook).toBe(true);
    expect(room.say("barnaby")?.speaker).toBe("Barnaby Bramblefoot");
    expect(room.say("unknown")).toBeUndefined();
  });

  it("summons the companion as a party-side entity in the current scene", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // into the Hearth, where Brennar joins

    const joined = await room.summonCompanion();

    expect(joined).toBe("Old Brennar");
    const brennar = (await room.getState()).entities[TUTORIAL_COMPANION.id];
    expect(brennar?.kind).toBe("character");
    expect(brennar?.sceneId).toBe(TUTORIAL_SCENE_HEARTH);
    // Idempotent: a second summon is a no-op.
    expect(await room.summonCompanion()).toBeNull();
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
    await room.advance(); // the Hearth scene has no offered check

    expect(await room.runScriptedCheck()).toBeNull();
  });

  it("resolves the chest check with advantage and always rolls for the lead PC", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth
    await room.summonCompanion(); // Brennar is now also a character entity
    await room.advance(); // → Crooked Lane
    await room.advance(); // → Spire Lower Hall (the chest scene)

    const result = await room.runScriptedCheck({ mode: "advantage" });

    expect(result?.accepted).toBe(true);
    // The lead (Mira) rolls — not the companion, even though both are present.
    expect(result?.actorName).toBe("Mira Thornwood");
    expect(result?.check.skill).toBe("Thieves' Tools");
    expect(result?.check.loot?.length).toBeGreaterThan(0);
    expect(typeof (result?.summary as { success?: boolean }).success).toBe(
      "boolean",
    );
  });
});
