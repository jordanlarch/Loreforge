import { describe, expect, it } from "vitest";

import {
  DEFAULT_STARTING_LOCATION,
  DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS,
  DEMO_DUNGEON_FEAR_STRESS_SLUGS,
  FIXTURE_BATTLE_SCENE_ID,
  InMemoryEventStore,
  resolveEncounterMap,
  realmNpcEntityId,
  sceneIdForRealmEntity,
  sceneIdForDungeonRoom,
  type EventStore,
  type FoeSpec,
  type PartyMember,
} from "@app/engine";

import { CampaignRoom } from "./room.js";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000aa";
const TAVERN_ID = "11111111-1111-4111-8111-111111111111";

async function activeEntity(room: CampaignRoom) {
  const state = await room.getState();
  const active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
  return { state, active, from: state.entities[active]!.position! };
}

async function explorationPc(room: CampaignRoom) {
  const state = await room.getState();
  expect(state.encounter).toBeUndefined();
  const pc = Object.values(state.entities).find(
    (e) => e.kind === "character" && !e.id.startsWith("npc:"),
  );
  expect(pc?.position).toBeDefined();
  return { state, active: pc!.id, from: pc!.position! };
}

describe("CampaignRoom", () => {
  it("seeds the goblin-ambush encounter into an empty log on first load", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store);

    const state = await room.getState();

    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);
    expect(state.encounter?.initiativeRolled).toBe(true);
    expect(state.encounter?.order).toHaveLength(6);
    // The seed was persisted, not held only in memory.
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(0);
  });

  it("persists accepted moves and survives a cold reload (no re-seed)", async () => {
    const store: EventStore = new InMemoryEventStore();

    const first = new CampaignRoom(CAMPAIGN, store);
    const { active, from } = await activeEntity(first);
    const to = { x: from.x, y: from.y + 1 };
    expect((await first.apply({ type: "move_entity", entity: active, to })).accepted).toBe(true);

    // A fresh room over the same store == a server restart / idle eviction.
    const reloaded = new CampaignRoom(CAMPAIGN, store);
    const state = await reloaded.getState();

    // State reflects the persisted move rather than resetting to the fixture.
    expect(state.entities[active]?.position).toEqual(to);
  });

  it("does not re-seed a log that already has events", async () => {
    const store = new InMemoryEventStore();
    const seeded = new CampaignRoom(CAMPAIGN, store);
    await seeded.getState();
    const afterSeed = await store.lastSequence(CAMPAIGN);

    const reloaded = new CampaignRoom(CAMPAIGN, store);
    await reloaded.getState();

    expect(await store.lastSequence(CAMPAIGN)).toBe(afterSeed);
  });

  it("reset truncates the log back to the seeded baseline", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store);
    const { active, from } = await activeEntity(room);
    const baseline = await store.lastSequence(CAMPAIGN);

    await room.apply({ type: "move_entity", entity: active, to: { x: from.x, y: from.y + 1 } });
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(baseline);

    await room.reset();

    expect(await store.lastSequence(CAMPAIGN)).toBe(baseline);
    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });

  it("seeds exploration (no combat) when a party loader returns members (#98, Rung 4)", async () => {
    const store = new InMemoryEventStore();
    const party: PartyMember[] = [
      {
        id: "char:hero",
        name: "Bridged Hero",
        abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
        maxHp: 30,
        baseAc: 16,
        speed: 30,
        classes: [{ class: "Fighter", level: 3 }],
      },
    ];
    const room = new CampaignRoom(CAMPAIGN, store, async () => party);

    const state = await room.getState();

    expect(state.entities["char:hero"]?.name).toBe("Bridged Hero");
    expect(state.encounter).toBeUndefined();
    expect(state.entities["npc:goblin-a"]).toBeUndefined();
  });

  it("seeds exploration with the fixture party when the roster is empty (Rung 4)", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store, async () => []);

    const state = await room.getState();

    expect(state.encounter).toBeUndefined();
    expect(Object.keys(state.entities).length).toBeGreaterThan(0);
    expect(state.entities["npc:goblin-a"]).toBeUndefined();
  });

  it("reset replays the roster-seeded exploration baseline (not the fixture combat)", async () => {
    const store = new InMemoryEventStore();
    const party: PartyMember[] = [
      {
        id: "char:solo",
        name: "Solo",
        abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
        maxHp: 24,
        baseAc: 15,
        speed: 30,
        classes: [{ class: "Rogue", level: 2 }],
      },
    ];
    const room = new CampaignRoom(CAMPAIGN, store, async () => party);
    await room.getState();
    const baseline = await store.lastSequence(CAMPAIGN);

    const { active, from } = await explorationPc(room);
    await room.apply({ type: "move_entity", entity: active, to: { x: from.x, y: from.y + 1 } });
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(baseline);

    await room.reset();

    expect(await store.lastSequence(CAMPAIGN)).toBe(baseline);
    const after = await room.getState();
    expect(after.encounter).toBeUndefined();
    expect(after.entities["char:solo"]).toBeDefined();
  });

  it("seeds an armed authored encounter's foes instead of exploration (#115)", async () => {
    const store = new InMemoryEventStore();
    const foes: FoeSpec[] = [
      {
        id: "npc:foe-0",
        name: "Ogre 1",
        abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
        maxHp: 59,
        baseAc: 11,
        speed: 40,
      },
      {
        id: "npc:foe-1",
        name: "Ogre 2",
        abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
        maxHp: 59,
        baseAc: 11,
        speed: 40,
      },
      {
        id: "npc:foe-2",
        name: "Ogre 3",
        abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
        maxHp: 59,
        baseAc: 11,
        speed: 40,
      },
    ];
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => ({ name: "Ogre Den", foes, map: resolveEncounterMap("ambush") }),
    );

    const state = await room.getState();

    expect(state.scenes[FIXTURE_BATTLE_SCENE_ID]?.name).toBe("Ogre Den");
    // Fixture party (4 PCs) + the three authored ogres = 7 combatants.
    expect(state.encounter?.combatants).toHaveLength(7);
    expect(state.entities["npc:foe-0"]?.name).toBe("Ogre 1");
    expect(state.entities["npc:foe-2"]?.hp.max).toBe(59);
    // The default goblins are absent.
    expect(state.entities["npc:goblin-a"]).toBeUndefined();
  });

  it("opens in exploration at a World-tab tavern when no encounter is armed (Rung 4)", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => undefined,
      async () => ({
        entityId: TAVERN_ID,
        name: "The Crooked Tankard",
        summary: "Smoke and laughter spill from the open door.",
        type: "tavern",
      }),
    );

    const state = await room.getState();
    const sceneId = sceneIdForRealmEntity(TAVERN_ID);

    expect(state.currentSceneId).toBe(sceneId);
    expect(state.scenes[sceneId]?.name).toBe("The Crooked Tankard");
    expect(state.encounter).toBeUndefined();
    expect(state.entities["npc:goblin-a"]).toBeUndefined();
  });

  it("falls back to the generic starting location when world lookup is empty (Rung 4)", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => undefined,
      async () => undefined,
    );

    const state = await room.getState();
    const sceneId = sceneIdForRealmEntity(DEFAULT_STARTING_LOCATION.entityId);

    expect(state.currentSceneId).toBe(sceneId);
    expect(state.scenes[sceneId]?.name).toBe(DEFAULT_STARTING_LOCATION.name);
    expect(state.encounter).toBeUndefined();
  });

  it("re-seeds after an external log truncate (Run Now from combat tab)", async () => {
    const store = new InMemoryEventStore();
    const ogreFoes: FoeSpec[] = [
      {
        id: "npc:foe-0",
        name: "Ogre 1",
        abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
        maxHp: 59,
        baseAc: 11,
        speed: 40,
      },
    ];
    let armed = false;
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () =>
        armed
          ? { name: "Ogre Den", foes: ogreFoes, map: resolveEncounterMap("ambush") }
          : undefined,
      async () => undefined,
    );

    const first = await room.getState();
    expect(first.encounter).toBeUndefined();
    expect(first.entities["npc:goblin-a"]).toBeUndefined();

    armed = true;
    await store.truncate(CAMPAIGN, 0);

    const second = await room.getState();
    expect(second.scenes[FIXTURE_BATTLE_SCENE_ID]?.name).toBe("Ogre Den");
    expect(second.entities["npc:foe-0"]?.name).toBe("Ogre 1");
    expect(second.entities["npc:goblin-a"]).toBeUndefined();
  });

  it("enters another World-tab location via enterLocation (Rung 4 Slice 2)", async () => {
    const store = new InMemoryEventStore();
    const settlement = {
      entityId: "22222222-2222-4222-8222-222222222222",
      name: "Ferryrest",
      summary: "A humble hamlet.",
      type: "settlement" as const,
    };
    const tavern = {
      entityId: TAVERN_ID,
      name: "The Crooked Tankard",
      summary: "Smoke and laughter.",
      type: "tavern" as const,
    };
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => undefined,
      async () => settlement,
    );
    await room.getState();

    const { changed } = await room.enterLocation(tavern);
    expect(changed).toBe(true);

    const state = await room.getState();
    expect(state.currentSceneId).toBe(sceneIdForRealmEntity(TAVERN_ID));
    expect(state.scenes[state.currentSceneId!]?.name).toBe("The Crooked Tankard");
  });

  it("spawns World-tab NPC tokens when entering a location (Rung 4 Slice 3)", async () => {
    const store = new InMemoryEventStore();
    const npcEntityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const settlement = {
      entityId: "22222222-2222-4222-8222-222222222222",
      name: "Ferryrest",
      summary: "A humble hamlet.",
      type: "settlement" as const,
    };
    const tavern = {
      entityId: TAVERN_ID,
      name: "The Crooked Tankard",
      summary: "Smoke and laughter.",
      type: "tavern" as const,
    };
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => undefined,
      async () => settlement,
      async () => ({
        npcs: [
          {
            entityId: npcEntityId,
            name: "Barkeep",
            abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 12 },
            maxHp: 12,
            baseAc: 10,
            speed: 30,
          },
        ],
      }),
    );
    await room.getState();

    await room.enterLocation(tavern, {
      npcs: [
        {
          entityId: npcEntityId,
          name: "Barkeep",
          abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 12 },
          maxHp: 12,
          baseAc: 10,
          speed: 30,
        },
      ],
    });

    const state = await room.getState();
    expect(state.entities[realmNpcEntityId(npcEntityId)]?.name).toBe("Barkeep");
  });

  it("starts combat when entering a dungeon (Rung 4 Slice 3)", async () => {
    const store = new InMemoryEventStore();
    const settlement = {
      entityId: "22222222-2222-4222-8222-222222222222",
      name: "Ferryrest",
      summary: "A humble hamlet.",
      type: "settlement" as const,
    };
    const dungeon = {
      entityId: "33333333-3333-4333-8333-333333333333",
      name: "Whisper Crypt",
      summary: "Damp stone.",
      type: "dungeon" as const,
    };
    const room = new CampaignRoom(
      CAMPAIGN,
      store,
      async () => [],
      async () => undefined,
      async () => settlement,
    );
    await room.getState();

    const { changed, startedCombat } = await room.enterLocation(dungeon, {
      entityData: { wanderingMonsters: ["skeletons"] },
    });
    expect(changed).toBe(true);
    expect(startedCombat).toBe(true);

    const state = await room.getState();
    expect(state.encounter?.initiativeRolled).toBe(true);
    expect(Object.keys(state.entities).some((id) => id.startsWith("npc:dungeon:"))).toBe(
      true,
    );

    const sceneId = sceneIdForDungeonRoom(dungeon.entityId, 0);
    expect(state.currentSceneId).toBe(sceneId);
    expect(state.dungeonProgress?.currentRoomIndex).toBe(0);
    expect(state.scenes[sceneId]?.environmentalEffectSlugs).toEqual([
      ...DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS,
    ]);
    const pc = Object.values(state.entities).find(
      (e) => e.kind === "character" && !e.id.startsWith("npc:"),
    );
    expect(
      pc?.activeEnvironmentalEffects?.some(
        (i) => i.effectSlug === "srd-2024_extreme-cold",
      ),
    ).toBe(true);

    const events = await store.read(CAMPAIGN);
    const fearApplied = events.some(
      (e) =>
        e.type === "FearStressApplied" &&
        (e.payload as { fearStressSlug?: string }).fearStressSlug ===
          "srd-2024_sarcophagus-apparition",
    );
    const fearSaveRolled = events.some(
      (e) =>
        e.type === "SaveRolled" &&
        (e.payload as { ability?: string; dc?: number }).ability === "wis" &&
        (e.payload as { dc?: number }).dc === 10,
    );
    expect(fearApplied || fearSaveRolled).toBe(true);
    expect(DEMO_DUNGEON_FEAR_STRESS_SLUGS).toContain(
      "srd-2024_sarcophagus-apparition",
    );
  });

  it("rejects an illegal move (into a wall) and leaves state unchanged", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store);
    const { state, active, from } = await activeEntity(room);
    const wall = state.scenes[FIXTURE_BATTLE_SCENE_ID]!.map!.blockedCells[0]!;

    const result = await room.apply({ type: "move_entity", entity: active, to: wall });

    expect(result.accepted).toBe(false);
    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });
});
