import { describe, expect, it } from "vitest";

import { Engine } from "../engine";
import {
  TUTORIAL_NPC_BARNABY_ID,
  TUTORIAL_NPC_LILY_ID,
  TUTORIAL_NPC_TORIC_ID,
  TUTORIAL_NPC_MARLOWE_ID,
  createTutorialNpcCommands,
  buildCompanionCommands,
  buildTutorialSceneRepairCommands,
  buildTutorialSeedCommands,
  resolveTutorialLeadEntityId,
  classifyScene2Topic,
  nextTutorialScene,
  tutorialAchievement,
  tutorialBeat,
  tutorialRelightPath,
  tutorialScene,
  TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
  TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
  TUTORIAL_ACHIEVEMENTS,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_OIL_NAME,
  TUTORIAL_RESOLUTION,
  TUTORIAL_SCENE_CROOKED_LANE,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE1_VILLAGE_ROW,
  TUTORIAL_SCENE_SPIRE_LOWER,
  TUTORIAL_SCENE_SPIRE_STAIR,
  TUTORIAL_SCENE_SPIRE_UPPER,
  TUTORIAL_SHADE_ID,
  TUTORIAL_WRAP,
  classifyTutorialLeaveIntent,
  classifyTutorialRelightIntent,
  isTutorialFriendlyFireTarget,
  tutorialChatFallback,
  tutorialHintForScene,
  tutorialScene1VillageReached,
  TUTORIAL_SCENE_HINTS,
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

/** Enter the scene after `fromSceneId` (or the first scene when undefined). */
async function enterSceneAfter(
  engine: Engine,
  fromSceneId: string | undefined,
): Promise<void> {
  const next = nextTutorialScene(fromSceneId);
  if (!next) return;
  for (const command of next.enter(TUTORIAL_FALLBACK_PARTY)) {
    await engine.execute(CAMPAIGN, command);
  }
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
    const barnaby = state.entities[TUTORIAL_NPC_BARNABY_ID];
    const lily = state.entities[TUTORIAL_NPC_LILY_ID];
    expect(barnaby?.kind).toBe("npc");
    expect(barnaby?.name).toBe("Barnaby Bramblefoot");
    expect(barnaby?.position).toEqual({ x: 2, y: 2 });
    expect(lily?.kind).toBe("npc");
    expect(lily?.name).toBe("Lily Lampmaker");
    expect(lily?.position).toEqual({ x: 8, y: 6 });
  });

  it("places Toric on the Crooked Lane and Marlowe in the upper spire", async () => {
    const engine = await seed();
    await enterSceneAfter(engine, TUTORIAL_SCENE_HOLLOWS_EDGE);
    await enterSceneAfter(engine, TUTORIAL_SCENE_HEARTH);

    const laneState = await engine.getState(CAMPAIGN);
    const toric = laneState.entities[TUTORIAL_NPC_TORIC_ID];
    expect(toric?.name).toBe("Toric Pennywhistle");
    expect(toric?.sceneId).toBe(TUTORIAL_SCENE_CROOKED_LANE);

    await enterSceneAfter(engine, TUTORIAL_SCENE_CROOKED_LANE);
    await enterSceneAfter(engine, TUTORIAL_SCENE_SPIRE_LOWER);
    await enterSceneAfter(engine, TUTORIAL_SCENE_SPIRE_STAIR);
    await enterSceneAfter(engine, TUTORIAL_SCENE_SPIRE_UPPER);

    const marlowe = (await engine.getState(CAMPAIGN)).entities[
      TUTORIAL_NPC_MARLOWE_ID
    ];
    expect(marlowe?.name).toBe("Marlowe the Lampkeeper");
    expect(marlowe?.sceneId).toBe(TUTORIAL_SCENE_SPIRE_UPPER);
  });

  it("createTutorialNpcCommands builds stationary npc entities", () => {
    const cmds = createTutorialNpcCommands("scene:test", [
      { id: "npc:test", name: "Test NPC", position: { x: 1, y: 2 } },
    ]);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]?.type).toBe("create_entity");
    if (cmds[0]?.type !== "create_entity") throw new Error("expected create_entity");
    expect(cmds[0].entity.kind).toBe("npc");
    expect(cmds[0].entity.speed).toBe(0);
  });

  it("resolves the legacy fixture lead id when the roster uuid is absent", async () => {
    const engine = await seed();
    const state = await engine.getState(CAMPAIGN);
    const legacyId = TUTORIAL_FALLBACK_PARTY[0]!.id;
    expect(state.entities[legacyId]).toBeDefined();
    expect(
      resolveTutorialLeadEntityId(
        [{ ...TUTORIAL_FALLBACK_PARTY[0]!, id: "char:mira-row" }],
        state.entities,
      ),
    ).toBe(legacyId);
  });

  it("repairs missing NPC tokens on the current exploration scene", async () => {
    const engine = await seed();
    const hearth = nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE)!;
    for (const command of hearth.enter(TUTORIAL_FALLBACK_PARTY)) {
      if (
        command.type === "create_entity" &&
        command.entity.kind === "npc"
      ) {
        continue;
      }
      await engine.execute(CAMPAIGN, command);
    }
    let state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_HEARTH);
    expect(state.entities[TUTORIAL_NPC_BARNABY_ID]).toBeUndefined();

    for (const command of buildTutorialSceneRepairCommands(
      TUTORIAL_SCENE_HEARTH,
      TUTORIAL_FALLBACK_PARTY,
      state,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    state = await engine.getState(CAMPAIGN);
    expect(state.entities[TUTORIAL_NPC_BARNABY_ID]?.sceneId).toBe(
      TUTORIAL_SCENE_HEARTH,
    );
    expect(state.entities[TUTORIAL_NPC_LILY_ID]?.position).toEqual({ x: 8, y: 6 });
    expect(state.entities[TUTORIAL_FALLBACK_PARTY[0]!.id]?.sceneId).toBe(
      TUTORIAL_SCENE_HEARTH,
    );
  });

  it("backfills a missing companion when the DB party is active but join was skipped", async () => {
    const engine = await seed();
    for (const command of nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE)!.enter(
      TUTORIAL_FALLBACK_PARTY,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    const partyWithCompanion = [
      ...TUTORIAL_FALLBACK_PARTY,
      { ...TUTORIAL_COMPANION, id: "char:brennar-row" },
    ];
    let state = await engine.getState(CAMPAIGN);
    expect(state.entities[TUTORIAL_COMPANION.id]).toBeUndefined();

    for (const command of buildTutorialSceneRepairCommands(
      TUTORIAL_SCENE_HEARTH,
      partyWithCompanion,
      state,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    state = await engine.getState(CAMPAIGN);
    expect(state.entities[TUTORIAL_COMPANION.id]?.sceneId).toBe(
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

  it("advances to the Crooked Lane, carrying the PC and the companion", async () => {
    const engine = await seed();
    const leadId = TUTORIAL_FALLBACK_PARTY[0]!.id;

    // Walk Hollow's Edge → Hearth, summon the companion there, then on to the lane.
    for (const command of nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE)!.enter(
      TUTORIAL_FALLBACK_PARTY,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    for (const command of buildCompanionCommands(TUTORIAL_SCENE_HEARTH)) {
      await engine.execute(CAMPAIGN, command);
    }

    const lane = nextTutorialScene(TUTORIAL_SCENE_HEARTH);
    expect(lane?.id).toBe(TUTORIAL_SCENE_CROOKED_LANE);
    expect(lane?.mentions).toContain("Tinker's Mercy");
    for (const command of lane!.enter(TUTORIAL_FALLBACK_PARTY)) {
      await engine.execute(CAMPAIGN, command);
    }

    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_CROOKED_LANE);
    expect(state.scenes[TUTORIAL_SCENE_CROOKED_LANE]?.map).toBeDefined();
    // Both the lead PC and the companion are carried up the lane together.
    expect(state.entities[leadId]?.sceneId).toBe(TUTORIAL_SCENE_CROOKED_LANE);
    expect(state.entities[TUTORIAL_COMPANION.id]?.sceneId).toBe(
      TUTORIAL_SCENE_CROOKED_LANE,
    );
  });

  it("relocating an absent companion is a safe no-op (hook not accepted)", async () => {
    const engine = await seed();
    // Advance straight to the lane without ever summoning Brennar.
    for (const command of nextTutorialScene(TUTORIAL_SCENE_HOLLOWS_EDGE)!.enter(
      TUTORIAL_FALLBACK_PARTY,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    for (const command of nextTutorialScene(TUTORIAL_SCENE_HEARTH)!.enter(
      TUTORIAL_FALLBACK_PARTY,
    )) {
      await engine.execute(CAMPAIGN, command);
    }
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_CROOKED_LANE);
    expect(state.entities[TUTORIAL_COMPANION.id]).toBeUndefined();
  });

  it("advances to the Spire Lower Hall, offering a chest check that grants loot", async () => {
    const engine = await seed();
    const leadId = TUTORIAL_FALLBACK_PARTY[0]!.id;
    for (const from of [
      TUTORIAL_SCENE_HOLLOWS_EDGE,
      TUTORIAL_SCENE_HEARTH,
      TUTORIAL_SCENE_CROOKED_LANE,
    ]) {
      for (const command of nextTutorialScene(from)!.enter(TUTORIAL_FALLBACK_PARTY)) {
        await engine.execute(CAMPAIGN, command);
      }
    }
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_SPIRE_LOWER);
    expect(state.entities[leadId]?.sceneId).toBe(TUTORIAL_SCENE_SPIRE_LOWER);

    const scene = tutorialScene(TUTORIAL_SCENE_SPIRE_LOWER);
    expect(scene?.check?.skill).toBe("Thieves' Tools");
    expect(scene?.check?.proficient).toBe(false);
    expect(scene?.check?.helpPrompt).toBeTruthy();
    expect(scene?.check?.loot).toBe(TUTORIAL_CHEST_LOOT);
    expect(TUTORIAL_CHEST_LOOT.map((i) => i.name)).toContain(
      "Scroll of Cure Wounds",
    );
  });

  it("resolves the chest check with advantage (the Help action's mode)", async () => {
    const engine = await seed();
    const leadId = TUTORIAL_FALLBACK_PARTY[0]!.id;
    const result = await engine.execute(CAMPAIGN, {
      type: "ability_check",
      entity: leadId,
      ability: "dex",
      skill: "Thieves' Tools",
      dc: 13,
      mode: "advantage",
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    // The engine recorded the roll as an advantage check, and produced a verdict.
    const checkEvent = result.events.find((e) => e.type === "CheckRolled") as
      | { payload: { mode: string; total: number; success?: boolean } }
      | undefined;
    expect(checkEvent?.payload.mode).toBe("advantage");
    expect(typeof checkEvent?.payload.total).toBe("number");
    expect(typeof (result.summary as { success?: boolean }).success).toBe(
      "boolean",
    );
  });

  it("arms the Stair combat scene with the single Hungering Shade foe", async () => {
    const stair = nextTutorialScene(TUTORIAL_SCENE_SPIRE_LOWER);
    expect(stair?.id).toBe(TUTORIAL_SCENE_SPIRE_STAIR);
    // Scene 5 (#174): one boss-flavoured Shade, not the two earlier stub shadows.
    expect(stair?.combat?.foes.length).toBe(1);
    expect(stair?.combat?.foes[0]?.id).toBe(TUTORIAL_SHADE_ID);

    const engine = await seed();
    // Walk to the stair, running each scene's enter commands.
    for (const from of [
      TUTORIAL_SCENE_HOLLOWS_EDGE,
      TUTORIAL_SCENE_HEARTH,
      TUTORIAL_SCENE_CROOKED_LANE,
      TUTORIAL_SCENE_SPIRE_LOWER,
    ]) {
      for (const command of nextTutorialScene(from)!.enter(TUTORIAL_FALLBACK_PARTY)) {
        await engine.execute(CAMPAIGN, command);
      }
    }
    const state = await engine.getState(CAMPAIGN);
    expect(state.currentSceneId).toBe(TUTORIAL_SCENE_SPIRE_STAIR);
    // The foe is placed on the map (the driver then arms the encounter).
    const foes = Object.values(state.entities).filter(
      (e) => e.kind === "monster" && e.sceneId === TUTORIAL_SCENE_SPIRE_STAIR,
    );
    expect(foes).toHaveLength(1);
    expect(foes[0]?.id).toBe(TUTORIAL_SHADE_ID);
  });

  it("advances from the Stair to the Upper Chamber finale (Scene 6, #174)", () => {
    const upper = nextTutorialScene(TUTORIAL_SCENE_SPIRE_STAIR);
    expect(upper?.id).toBe(TUTORIAL_SCENE_SPIRE_UPPER);
    expect(upper?.combat).toBeUndefined();
  });

  it("returns no next scene at the end of the script", () => {
    expect(nextTutorialScene(TUTORIAL_SCENE_SPIRE_UPPER)).toBeUndefined();
    expect(nextTutorialScene("scene:not-a-tutorial-scene")).toBeUndefined();
  });

  it("attaches the finale resolution to the Upper Chamber scene (Scene 6, #175)", () => {
    const scene = tutorialScene(TUTORIAL_SCENE_SPIRE_UPPER);
    expect(scene?.resolution).toBe(TUTORIAL_RESOLUTION);
    // The choice framing + the spec's relight + memory beats are present.
    expect(scene?.narration).toContain("How do you light it?");
    expect(TUTORIAL_RESOLUTION.reputationNote).toMatch(/Honored/i);
    expect(TUTORIAL_RESOLUTION.levelUp.tooltipBody.length).toBeGreaterThan(0);
    expect(TUTORIAL_RESOLUTION.memory.pinSuggestion).toBe(
      "Lily gave me her father's key.",
    );
    expect(TUTORIAL_RESOLUTION.memory.mentions).toContain("Lily Lampmaker");
  });

  it("offers four distinct relight paths that converge on one resolution", () => {
    const ids = TUTORIAL_RESOLUTION.paths.map((p) => p.id);
    expect(ids).toEqual(["oil", "flint", "prayer", "improv"]);
    // Each path tells a distinct story (distinct narration), per the spec.
    const texts = TUTORIAL_RESOLUTION.paths.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.every((t) => t.length > 0)).toBe(true);
  });

  it("maps the Oil-of-Brightness path to the best outcome that consumes the item", () => {
    const oil = tutorialRelightPath("oil");
    expect(oil?.consumesItem).toBe(TUTORIAL_OIL_NAME);
    expect(oil?.text).toMatch(/white-gold|brilliant/i);
    // The other paths don't consume the oil.
    expect(tutorialRelightPath("flint")?.consumesItem).toBeUndefined();
    expect(tutorialRelightPath("improv")?.consumesItem).toBeUndefined();
  });

  it("gates the prayer path on a real engine ability check with a fallback", () => {
    const prayer = tutorialRelightPath("prayer");
    expect(prayer?.check?.skill).toBe("Religion");
    expect(prayer?.check?.dc).toBeGreaterThan(0);
    // A failed prayer converges narratively on the standard (warm-gold) outcome.
    expect(prayer?.check?.failureText).toMatch(/warm gold/i);
    expect(tutorialRelightPath("not-a-path")).toBeUndefined();
  });

  it("defines exactly the two tutorial achievements (Scene 7, #176)", () => {
    const ids = TUTORIAL_ACHIEVEMENTS.map((a) => a.id);
    expect(ids).toEqual([
      TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
      TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
    ]);
    // Each badge carries display copy for the graduation modal.
    for (const a of TUTORIAL_ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.unlockedWhen.length).toBeGreaterThan(0);
    }
    expect(tutorialAchievement(TUTORIAL_ACHIEVEMENT_FIRST_STEPS)?.title).toBe(
      "First Steps",
    );
    expect(tutorialAchievement(TUTORIAL_ACHIEVEMENT_FIRST_LIGHT)?.title).toBe(
      "First Light",
    );
    expect(tutorialAchievement("not-an-achievement")).toBeUndefined();
  });

  it("carries the Scene 7 wrap copy: closing beat + static recap", () => {
    expect(TUTORIAL_WRAP.narration.length).toBeGreaterThan(0);
    expect(TUTORIAL_WRAP.sessionComplete).toMatch(/complete/i);
    expect(TUTORIAL_WRAP.subtitle).toMatch(/complete/i);
    // The static recap lists the features the player exercised (no share gen).
    expect(TUTORIAL_WRAP.used.length).toBeGreaterThan(0);
    expect(TUTORIAL_WRAP.used).toContain("Tier-4 combat with reactions");
    expect(TUTORIAL_WRAP.closing.length).toBeGreaterThan(0);
  });
});

describe("Tutorial hints + fail-forward (#178)", () => {
  it("provides scripted hints for every playable scene", () => {
    expect(Object.keys(TUTORIAL_SCENE_HINTS).length).toBe(6);
    expect(tutorialHintForScene(TUTORIAL_SCENE_HEARTH)?.suggestions.length).toBeGreaterThan(0);
  });

  it("classifies leave intent for the village soft rail", () => {
    expect(classifyTutorialLeaveIntent("I turn back for the road")).toBe(true);
    expect(classifyTutorialLeaveIntent("I look for tracks")).toBe(false);
  });

  it("detects when Scene 1 PC reaches the village outskirts row", () => {
    expect(
      tutorialScene1VillageReached(TUTORIAL_SCENE_HOLLOWS_EDGE, {
        x: 6,
        y: TUTORIAL_SCENE1_VILLAGE_ROW,
      }),
    ).toBe(true);
    expect(
      tutorialScene1VillageReached(TUTORIAL_SCENE_HOLLOWS_EDGE, {
        x: 6,
        y: TUTORIAL_SCENE1_VILLAGE_ROW + 1,
      }),
    ).toBe(false);
    expect(
      tutorialScene1VillageReached(TUTORIAL_SCENE_HEARTH, { x: 1, y: 1 }),
    ).toBe(false);
  });

  it("classifies Scene 6 relight intent from free-text (#178)", () => {
    expect(
      classifyTutorialRelightIntent(
        "I light it with any materials that I currently have",
      ),
    ).toBe("improv");
    expect(classifyTutorialRelightIntent("Use Toric's oil on the lantern")).toBe(
      "oil",
    );
    expect(
      classifyTutorialRelightIntent("I strike Marlowe's flint and light the wick"),
    ).toBe("flint");
    expect(classifyTutorialRelightIntent("I ask about the weather")).toBeNull();
  });

  it("blocks friendly-fire targets but not the Shade", () => {
    expect(
      isTutorialFriendlyFireTarget(
        { id: TUTORIAL_COMPANION.id, kind: "character" },
        "pc:mira",
      ),
    ).toBe(true);
    expect(
      isTutorialFriendlyFireTarget(
        { id: TUTORIAL_SHADE_ID, kind: "monster" },
        "pc:mira",
      ),
    ).toBe(false);
  });

  it("falls back to scene-2 beats from free text when the LLM is offline", () => {
    expect(tutorialChatFallback(TUTORIAL_SCENE_HEARTH, "I'll talk to Barnaby")).toMatch(
      /Barnaby/i,
    );
  });
});
