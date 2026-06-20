import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { buildFixtureBattle, moveAction } from "@app/engine";

import { readProjection, writeProjection } from "./projection.js";

describe("writeProjection / readProjection", () => {
  it("round-trips the battle-relevant world state through a Y.Doc", async () => {
    const { state } = await buildFixtureBattle();
    const doc = new Y.Doc();

    writeProjection(doc, state);
    const read = readProjection(doc);

    expect(read).not.toBeNull();
    expect(read!.currentSceneId).toBe(state.currentSceneId);
    expect(read!.encounter?.order).toEqual(state.encounter?.order);
    expect(read!.encounter?.activeIndex).toBe(state.encounter?.activeIndex);

    // Every placed combatant survives with its position and HP intact.
    for (const ref of state.encounter!.combatants) {
      expect(read!.entities[ref]?.position).toEqual(
        state.entities[ref]?.position,
      );
      expect(read!.entities[ref]?.hp).toEqual(state.entities[ref]?.hp);
    }

    // The current scene's map (grid + walls) is carried for the renderer.
    const sceneId = state.currentSceneId!;
    expect(read!.scenes[sceneId]?.map).toEqual(state.scenes[sceneId]?.map);
  });

  it("returns null before the doc has been seeded", () => {
    expect(readProjection(new Y.Doc())).toBeNull();
  });

  it("writes only the entity that changed on a move (minimal diff)", async () => {
    const base = await buildFixtureBattle();
    const active = base.state.encounter!.order[0]!.entity;
    const from = base.state.entities[active]!.position!;
    const to = { x: from.x, y: from.y + 1 };
    const moved = await buildFixtureBattle([moveAction(active, to)]);

    const doc = new Y.Doc();
    writeProjection(doc, base.state);

    const diff = writeProjection(doc, moved.state);

    expect(diff.entities).toEqual([active]);
    expect(diff.scene).toBe(false);
    expect(diff.encounter).toBe(false);
    // The sequence number advanced, so meta is re-published.
    expect(diff.meta).toBe(true);
    expect(readProjection(doc)!.entities[active]?.position).toEqual(to);
  });

  it("is idempotent: re-writing identical state mutates nothing", async () => {
    const { state } = await buildFixtureBattle();
    const doc = new Y.Doc();
    writeProjection(doc, state);

    const diff = writeProjection(doc, state);

    expect(diff.meta).toBe(false);
    expect(diff.scene).toBe(false);
    expect(diff.encounter).toBe(false);
    expect(diff.entities).toEqual([]);
  });

  it("advances the active turn in the doc on end_turn", async () => {
    const base = await buildFixtureBattle();
    const ended = await buildFixtureBattle([{ type: "end_turn" }]);

    const doc = new Y.Doc();
    writeProjection(doc, base.state);
    writeProjection(doc, ended.state);

    expect(readProjection(doc)!.encounter?.activeIndex).toBe(
      ended.state.encounter?.activeIndex,
    );
    expect(ended.state.encounter?.activeIndex).not.toBe(
      base.state.encounter?.activeIndex,
    );
  });
});
