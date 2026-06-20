import { describe, expect, it } from "vitest";

import {
  buildFixtureBattle,
  FIXTURE_BATTLE_PARTY_SIDE,
  FIXTURE_BATTLE_SCENE_ID,
  moveAction,
} from "./battle";

describe("buildFixtureBattle", () => {
  it("starts a mapped encounter with initiative rolled", async () => {
    const { state, rejected } = await buildFixtureBattle();

    expect(rejected).toBe(0);
    expect(state.currentSceneId).toBe(FIXTURE_BATTLE_SCENE_ID);

    const scene = state.scenes[FIXTURE_BATTLE_SCENE_ID];
    expect(scene?.map).toBeDefined();
    expect(scene?.map?.blockedCells.length).toBeGreaterThan(0);

    const encounter = state.encounter;
    expect(encounter).toBeDefined();
    expect(encounter?.initiativeRolled).toBe(true);
    expect(encounter?.round).toBe(1);
    expect(encounter?.order).toHaveLength(4);
  });

  it("places every combatant on the grid", async () => {
    const { state } = await buildFixtureBattle();
    for (const ref of state.encounter!.combatants) {
      expect(state.entities[ref]?.position).toBeDefined();
    }
  });

  it("is deterministic across builds (same seed → same turn order)", async () => {
    const a = await buildFixtureBattle();
    const b = await buildFixtureBattle();
    expect(a.state.encounter?.order).toEqual(b.state.encounter?.order);
  });

  it("applies a legal move and reflects the new position", async () => {
    const base = await buildFixtureBattle();
    const active = base.state.encounter!.order[0]!.entity;
    const from = base.state.entities[active]!.position!;
    const to = { x: from.x, y: from.y + 1 };

    const moved = await buildFixtureBattle([moveAction(active, to)]);
    expect(moved.rejected).toBe(0);
    expect(moved.state.entities[active]?.position).toEqual(to);
  });

  it("rejects an illegal move (into a wall) and leaves position unchanged", async () => {
    const base = await buildFixtureBattle();
    const active = base.state.encounter!.order[0]!.entity;
    const from = base.state.entities[active]!.position!;
    const wall = base.state.scenes[FIXTURE_BATTLE_SCENE_ID]!.map!.blockedCells[0]!;

    const result = await buildFixtureBattle([moveAction(active, wall)]);
    expect(result.rejected).toBe(1);
    expect(result.state.entities[active]?.position).toEqual(from);
  });

  it("assigns the party side to player characters", async () => {
    const { state } = await buildFixtureBattle();
    const characters = Object.values(state.entities).filter(
      (e) => e.kind === "character",
    );
    for (const pc of characters) {
      expect(state.encounter?.sides[pc.id]).toBe(FIXTURE_BATTLE_PARTY_SIDE);
    }
  });
});
