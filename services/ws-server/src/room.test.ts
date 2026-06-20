import { describe, expect, it } from "vitest";

import { FIXTURE_BATTLE_SCENE_ID } from "@app/engine";

import { BattleRoom, isBattleAction } from "./room.js";

async function activeEntity(room: BattleRoom) {
  const state = await room.getState();
  const active = state.encounter!.order[state.encounter!.activeIndex]!.entity;
  return { state, active, from: state.entities[active]!.position! };
}

describe("BattleRoom", () => {
  it("seeds the goblin-ambush encounter with initiative rolled", async () => {
    const room = new BattleRoom();
    const state = await room.getState();

    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);
    expect(state.encounter?.initiativeRolled).toBe(true);
    expect(state.encounter?.order).toHaveLength(4);
  });

  it("applies a legal move and reflects the new position", async () => {
    const room = new BattleRoom();
    const { active, from } = await activeEntity(room);
    const to = { x: from.x, y: from.y + 1 };

    const result = await room.apply({ type: "move_entity", entity: active, to });

    expect(result.accepted).toBe(true);
    expect((await room.getState()).entities[active]?.position).toEqual(to);
  });

  it("rejects an illegal move (into a wall) and leaves state unchanged", async () => {
    const room = new BattleRoom();
    const { state, active, from } = await activeEntity(room);
    const wall = state.scenes[FIXTURE_BATTLE_SCENE_ID]!.map!.blockedCells[0]!;

    const result = await room.apply({ type: "move_entity", entity: active, to: wall });

    expect(result.accepted).toBe(false);
    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });

  it("advances the active combatant on end_turn", async () => {
    const room = new BattleRoom();
    const before = (await room.getState()).encounter!.activeIndex;

    const result = await room.apply({ type: "end_turn" });

    expect(result.accepted).toBe(true);
    expect((await room.getState()).encounter!.activeIndex).not.toBe(before);
  });

  it("reset rebuilds the original fixture state", async () => {
    const room = new BattleRoom();
    const { active, from } = await activeEntity(room);
    await room.apply({ type: "move_entity", entity: active, to: { x: from.x, y: from.y + 1 } });

    await room.reset();

    expect((await room.getState()).entities[active]?.position).toEqual(from);
  });
});

describe("isBattleAction", () => {
  it("accepts well-formed actions", () => {
    expect(isBattleAction({ type: "end_turn" })).toBe(true);
    expect(
      isBattleAction({ type: "move_entity", entity: "pc:1", to: { x: 1, y: 2 } }),
    ).toBe(true);
  });

  it("rejects malformed or unknown actions", () => {
    expect(isBattleAction(null)).toBe(false);
    expect(isBattleAction({ type: "attack" })).toBe(false);
    expect(isBattleAction({ type: "move_entity", entity: 5, to: { x: 1, y: 2 } })).toBe(false);
    expect(isBattleAction({ type: "move_entity", entity: "pc:1", to: { x: 1 } })).toBe(false);
  });
});
