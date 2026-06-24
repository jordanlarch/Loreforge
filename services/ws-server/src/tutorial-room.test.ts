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
  TUTORIAL_SCENE_SPIRE_UPPER,
  TUTORIAL_SHADE_ID,
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
    // The PC and the single Hungering Shade foe are in initiative (#174).
    const ids = state.encounter!.order.map((o) => o.entity);
    expect(ids).toContain(MIRA.id);
    expect(ids).toContain(TUTORIAL_SHADE_ID);
    expect(ids.filter((id) => id.startsWith("npc:tut-shade"))).toHaveLength(1);
  });

  it("advances from the Stair to the Upper Chamber finale, then ends (#174)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth
    await room.advance(); // → Crooked Lane
    await room.advance(); // → Spire Lower Hall
    await room.advance(); // → the Stair (combat)

    const finale = await room.advance(); // → the Upper Chamber (Scene 6)
    expect(finale?.sceneId).toBe(TUTORIAL_SCENE_SPIRE_UPPER);
    expect(finale?.combat).toBeFalsy();

    expect(await room.advance()).toBeNull();
  });

  it("endEncounter clears combat so the finale plays in exploration mode (#174)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.advance(); // → Hearth
    await room.advance(); // → Crooked Lane
    await room.advance(); // → Spire Lower Hall
    await room.advance(); // → the Stair (combat)
    expect((await room.getState()).encounter).toBeDefined();

    expect(await room.endEncounter()).toBe(true);
    expect((await room.getState()).encounter).toBeUndefined();

    const finale = await room.advance();
    expect(finale?.sceneId).toBe(TUTORIAL_SCENE_SPIRE_UPPER);
    expect((await room.getState()).encounter).toBeUndefined();
  });

  it("rescues a downed lead via the near-death safety net (#174)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    await room.getState();
    // Drop Mira to 0 HP through the engine, then the safety net heals her.
    // (apply_damage is a Command, not a BattleAction — cast for the test.)
    await room.apply({
      type: "apply_damage",
      target: MIRA.id,
      damageType: "necrotic",
      source: { amount: MIRA.maxHp },
    } as unknown as Parameters<typeof room.apply>[0]);
    expect((await room.getState()).entities[MIRA.id]?.hp.current).toBe(0);

    expect(await room.rescueLead(8)).toBe(true);
    expect((await room.getState()).entities[MIRA.id]?.hp.current).toBeGreaterThan(0);
    // Idempotent once she's up: a second rescue is a no-op.
    expect(await room.rescueLead(8)).toBe(false);
  });

  it("tracks the Shade's one scripted disengage", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    expect(room.shadeHasFled()).toBe(false);
    room.markShadeFled();
    expect(room.shadeHasFled()).toBe(true);
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

  it("rolls the Scene 6 prayer relight check through the engine for the lead PC (#175)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    const result = await room.runRelightCheck({
      ability: "int",
      skill: "Religion",
      dc: 10,
      proficient: false,
    });

    expect(result?.accepted).toBe(true);
    // The lead (Mira) rolls — a real deterministic engine verdict, not faked.
    expect(result?.actorName).toBe("Mira Thornwood");
    expect(result?.check.skill).toBe("Religion");
    expect(typeof (result?.summary as { total?: number }).total).toBe("number");
    expect(typeof (result?.summary as { success?: boolean }).success).toBe(
      "boolean",
    );
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

  it("serializes actions: acquire fails while one is in flight (#bug2)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    expect(room.acquireAction()).toBe(true);
    // A second, concurrent action is rejected until the first releases.
    expect(room.acquireAction()).toBe(false);
    room.releaseAction();
    expect(room.acquireAction()).toBe(true);
  });

  it("plays a one-shot beat at most once until reset (#bug2)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);

    expect(room.markOnce("say:barnaby")).toBe(true);
    expect(room.markOnce("say:barnaby")).toBe(false);
    // A different beat is independent.
    expect(room.markOnce("say:lily")).toBe(true);

    await room.reset();
    // Reset clears the played beats + the in-flight latch (full replay).
    expect(room.markOnce("say:barnaby")).toBe(true);
    expect(room.acquireAction()).toBe(true);
  });

  it("marks advance and check once per scene id (#bug2)", async () => {
    const store = new InMemoryEventStore();
    const room = new TutorialRoom(CAMPAIGN, store, async () => [MIRA]);
    const sceneId = (await room.getState()).currentSceneId!;

    expect(room.markOnce(`advance:${sceneId}`)).toBe(true);
    expect(room.markOnce(`advance:${sceneId}`)).toBe(false);
    expect(room.markOnce(`check:${sceneId}`)).toBe(true);
    expect(room.markOnce(`check:${sceneId}`)).toBe(false);
  });
});
