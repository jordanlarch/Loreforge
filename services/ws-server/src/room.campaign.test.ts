import { describe, expect, it } from "vitest";

import {
  FIXTURE_BATTLE_SCENE_ID,
  InMemoryEventStore,
  type EventStore,
  type PartyMember,
} from "@app/engine";

import { CampaignRoom } from "./room.js";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000aa";

async function activeEntity(room: CampaignRoom) {
  const state = await room.getState();
  const active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
  return { state, active, from: state.entities[active]!.position! };
}

describe("CampaignRoom", () => {
  it("seeds the goblin-ambush encounter into an empty log on first load", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store);

    const state = await room.getState();

    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);
    expect(state.encounter?.initiativeRolled).toBe(true);
    expect(state.encounter?.order).toHaveLength(4);
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

  it("seeds the real campaign roster when a party loader returns members (#98)", async () => {
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
    // Roster PC + the two goblin foes.
    expect(state.encounter?.combatants).toContain("char:hero");
    expect(state.encounter?.combatants).toHaveLength(3);
  });

  it("falls back to the fixture when the roster is empty", async () => {
    const store = new InMemoryEventStore();
    const room = new CampaignRoom(CAMPAIGN, store, async () => []);

    const state = await room.getState();

    expect(state.encounter?.order).toHaveLength(4); // fixture: 2 PCs + 2 goblins
  });

  it("reset replays the roster-seeded baseline (not the fixture's)", async () => {
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

    const { active, from } = await activeEntity(room);
    await room.apply({ type: "move_entity", entity: active, to: { x: from.x, y: from.y + 1 } });
    expect(await store.lastSequence(CAMPAIGN)).toBeGreaterThan(baseline);

    await room.reset();

    expect(await store.lastSequence(CAMPAIGN)).toBe(baseline);
    // The roster member is still present after a reset (3 combatants, not 4).
    expect((await room.getState()).encounter?.combatants).toHaveLength(3);
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
